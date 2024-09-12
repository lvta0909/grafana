import { useEffect, useState } from 'react';
import { Subscription } from 'rxjs';

import {
  DataHoverClearEvent,
  DataHoverEvent,
  FALLBACK_COLOR,
  FieldDisplay,
  formattedValueToString,
  getFieldDisplayValues,
  PanelProps,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { HideSeriesConfig, LegendDisplayMode } from '@grafana/schema';
import {
  SeriesVisibilityChangeBehavior,
  usePanelContext,
  useTheme2,
  VizLayout,
  VizLegend,
  VizLegendItem,
} from '@grafana/ui';

import { PieChart } from './PieChart';
import { PieChartLegendOptions, PieChartLegendValues, PieChartThresholdType, Options } from './panelcfg.gen';
import { filterDisplayItems, sumDisplayItemsReducer } from './utils';

const defaultLegendOptions: PieChartLegendOptions = {
  displayMode: LegendDisplayMode.List,
  showLegend: true,
  placement: 'right',
  calcs: [],
  values: [PieChartLegendValues.Percent],
};

interface Props extends PanelProps<Options> {}

/**
 * @beta
 */
export function PieChartPanel(props: Props) {
  const { data, timeZone, fieldConfig, replaceVariables, width, height, options, id } = props;

  const theme = useTheme2();
  const highlightedTitle = useSliceHighlightState();
  const fieldDisplayValues = getFieldDisplayValues({
    fieldConfig,
    reduceOptions: options.reduceOptions,
    data: data.series,
    theme: theme,
    replaceVariables,
    timeZone,
  });

  if (!hasFrames(fieldDisplayValues)) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  const newFieldDisplayValues = transformDisplayValues(options, fieldDisplayValues);

  return (
    <VizLayout width={width} height={height} legend={getLegend(props, newFieldDisplayValues)}>
      {(vizWidth: number, vizHeight: number) => {
        return (
          <PieChart
            width={vizWidth}
            height={vizHeight}
            highlightedTitle={highlightedTitle}
            fieldDisplayValues={newFieldDisplayValues}
            tooltipOptions={options.tooltip}
            pieType={options.pieType}
            displayLabels={options.displayLabels}
          />
        );
      }}
    </VizLayout>
  );
}

function transformDisplayValues(options: Options, displayValues: FieldDisplay[]): FieldDisplay[] {
  const thresholdNumber = options.thresholdNumber ?? 5;
  const groupedValuesLabel = options.groupedValuesLabel ?? 'Others';
  const thresholdPercentage = options.thresholdPercentage ?? 0.5;

  if (options.thresholdType === PieChartThresholdType.Number) {
    if (displayValues.length <= thresholdNumber) {
      return displayValues;
    }
    const firstN = displayValues.slice(0, options.thresholdNumber);
    const others = displayValues.slice(options.thresholdNumber);
    const totalNumericOthers = others.reduce((acc, item) => acc + item.display.numeric, 0);

    const othersItem: FieldDisplay = {
      display: {
        numeric: totalNumericOthers,
        title: groupedValuesLabel,
        color: '#CCCCCC',
        text: totalNumericOthers.toString(),
      },
      field: {
        custom: {},
      },
      name: 'others',
      hasLinks: false,
    };

    return [...firstN, othersItem];
  } else if (options.thresholdType === PieChartThresholdType.Percentage) {
    const total = displayValues.reduce((acc, item) => acc + item.display.numeric, 0);
    console.log('Total numeric value:', total);

    const thresholdValue = thresholdPercentage * total;
    console.log('Threshold percentage:', thresholdPercentage);
    console.log('Calculated threshold value:', thresholdValue);

    const aboveThreshold = displayValues.filter((item) => item.display.numeric >= thresholdValue);
    console.log('Items above threshold:', aboveThreshold);

    const belowThreshold = displayValues.filter((item) => item.display.numeric < thresholdValue);
    console.log('Items below threshold:', belowThreshold);

    if (belowThreshold.length === 0) {
      return displayValues;
    }

    const totalNumericBelow = belowThreshold.reduce((acc, item) => acc + item.display.numeric, 0);
    console.log('Total numeric value of items below threshold:', totalNumericBelow);

    const othersItem: FieldDisplay = {
      display: {
        numeric: totalNumericBelow,
        title: groupedValuesLabel,
        color: '#CCCCCC',
        text: totalNumericBelow.toString(),
      },
      field: {
        custom: {},
      },
      name: 'others',
      hasLinks: false,
    };

    return [...aboveThreshold, othersItem];
  }

  return displayValues;
}

function getLegend(props: Props, displayValues: FieldDisplay[]) {
  const legendOptions = props.options.legend ?? defaultLegendOptions;

  if (legendOptions.showLegend === false) {
    return undefined;
  }
  const total = displayValues.filter(filterDisplayItems).reduce(sumDisplayItemsReducer, 0);

  const legendItems: VizLegendItem[] = displayValues
    // Since the pie chart is always sorted, let's sort the legend as well.
    .sort((a, b) => {
      if (isNaN(a.display.numeric)) {
        return 1;
      } else if (isNaN(b.display.numeric)) {
        return -1;
      } else {
        return b.display.numeric - a.display.numeric;
      }
    })
    .map<VizLegendItem | undefined>((value: FieldDisplay, idx: number) => {
      const hideFrom: HideSeriesConfig = value.field.custom?.hideFrom ?? {};

      if (hideFrom.legend) {
        return undefined;
      }

      const hideFromViz = Boolean(hideFrom.viz);

      const display = value.display;
      return {
        label: display.title ?? '',
        color: display.color ?? FALLBACK_COLOR,
        yAxis: 1,
        disabled: hideFromViz,
        getItemKey: () => (display.title ?? '') + idx,
        getDisplayValues: () => {
          const valuesToShow = legendOptions.values ?? [];
          let displayValues = [];

          if (valuesToShow.includes(PieChartLegendValues.Value)) {
            displayValues.push({ numeric: display.numeric, text: formattedValueToString(display), title: 'Value' });
          }

          if (valuesToShow.includes(PieChartLegendValues.Percent)) {
            const fractionOfTotal = hideFromViz ? 0 : display.numeric / total;
            const percentOfTotal = fractionOfTotal * 100;

            displayValues.push({
              numeric: fractionOfTotal,
              percent: percentOfTotal,
              text:
                hideFromViz || isNaN(fractionOfTotal)
                  ? (props.fieldConfig.defaults.noValue ?? '-')
                  : percentOfTotal.toFixed(value.field.decimals ?? 0) + '%',
              title: valuesToShow.length > 1 ? 'Percent' : '',
            });
          }

          return displayValues;
        },
      };
    })
    .filter((i): i is VizLegendItem => !!i);

  return (
    <VizLayout.Legend placement={legendOptions.placement} width={legendOptions.width}>
      <VizLegend
        items={legendItems}
        seriesVisibilityChangeBehavior={SeriesVisibilityChangeBehavior.Hide}
        placement={legendOptions.placement}
        displayMode={legendOptions.displayMode}
      />
    </VizLayout.Legend>
  );
}

function hasFrames(fieldDisplayValues: FieldDisplay[]) {
  return fieldDisplayValues.some((fd) => fd.view?.dataFrame.length);
}

function useSliceHighlightState() {
  const [highlightedTitle, setHighlightedTitle] = useState<string>();
  const { eventBus } = usePanelContext();

  useEffect(() => {
    const setHighlightedSlice = (event: DataHoverEvent) => {
      setHighlightedTitle(event.payload.dataId);
    };

    const resetHighlightedSlice = (event: DataHoverClearEvent) => {
      setHighlightedTitle(undefined);
    };

    const subs = new Subscription();
    subs.add(eventBus.getStream(DataHoverEvent).subscribe({ next: setHighlightedSlice }));
    subs.add(eventBus.getStream(DataHoverClearEvent).subscribe({ next: resetHighlightedSlice }));

    return () => {
      subs.unsubscribe();
    };
  }, [setHighlightedTitle, eventBus]);

  return highlightedTitle;
}
