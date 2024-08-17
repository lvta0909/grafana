import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { addStandardDataReduceOptions } from '../stat/common';

import { PieChartPanel } from './PieChartPanel';
import { PieChartPanelChangedHandler } from './migrations';
import {
  Options,
  FieldConfig,
  PieChartType,
  PieChartLabels,
  PieChartLegendValues,
  PieChartThresholdType,
} from './panelcfg.gen';
import { PieChartSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options, FieldConfig>(PieChartPanel)
  .setPanelChangeHandler(PieChartPanelChangedHandler)
  .useFieldConfig({
    disableStandardOptions: [FieldConfigProperty.Thresholds],
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
          bySeriesSupport: true,
          preferThresholdsMode: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
    useCustomConfig: (builder) => {
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    addStandardDataReduceOptions(builder);
    builder
      .addRadio({
        name: 'Piechart type',
        description: 'How the piechart should be rendered',
        path: 'pieType',
        settings: {
          options: [
            { value: PieChartType.Pie, label: 'Pie' },
            { value: PieChartType.Donut, label: 'Donut' },
          ],
        },
        defaultValue: PieChartType.Pie,
      })
      .addMultiSelect({
        name: 'Labels',
        path: 'displayLabels',
        description: 'Select the labels to be displayed in the pie chart',
        settings: {
          options: [
            { value: PieChartLabels.Percent, label: 'Percent' },
            { value: PieChartLabels.Name, label: 'Name' },
            { value: PieChartLabels.Value, label: 'Value' },
          ],
        },
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder, false);

    builder.addMultiSelect({
      name: 'Legend values',
      path: 'legend.values',
      category: ['Legend'],
      settings: {
        options: [
          { value: PieChartLegendValues.Percent, label: 'Percent' },
          { value: PieChartLegendValues.Value, label: 'Value' },
        ],
      },
      showIf: (c) => c.legend.showLegend !== false,
    });

    builder
      .addRadio({
        name: 'Threshold Type',
        description: 'Type of threshold to group/show values',
        path: 'thresholdType',
        settings: {
          options: [
            { value: PieChartThresholdType.Percentage, label: 'Bellow percentage' },
            { value: PieChartThresholdType.Number, label: 'Show top values' },
          ],
        },
        defaultValue: PieChartThresholdType.Percentage,
      })
      .addNumberInput({
        name: 'Threshold Percentage',
        description: 'Percentage value for the threshold',
        path: 'thresholdPercentage',
        showIf: (config) => config.thresholdType === PieChartThresholdType.Percentage,
        defaultValue: 0.5,
        settings: {
          min: 0,
          max: 1,
        },
      })
      .addNumberInput({
        name: 'Threshold Number',
        description: 'Number of values to show in the chart',
        path: 'thresholdNumber',
        showIf: (config) => config.thresholdType === PieChartThresholdType.Number,
        defaultValue: 10,
        settings: {
          min: 1,
        },
      });
  })
  .setSuggestionsSupplier(new PieChartSuggestionsSupplier());
