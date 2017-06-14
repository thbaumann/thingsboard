/*
 * Copyright © 2016-2017 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import './alarms-table-widget.scss';

/* eslint-disable import/no-unresolved, import/default */

import alarmsTableWidgetTemplate from './alarms-table-widget.tpl.html';
import alarmDetailsDialogTemplate from '../../alarm/alarm-details-dialog.tpl.html';

/* eslint-enable import/no-unresolved, import/default */

import tinycolor from 'tinycolor2';
import cssjs from '../../../vendor/css.js/css';

export default angular.module('thingsboard.widgets.alarmsTableWidget', [])
    .directive('tbAlarmsTableWidget', AlarmsTableWidget)
    .name;

/*@ngInject*/
function AlarmsTableWidget() {
    return {
        restrict: "E",
        scope: true,
        bindToController: {
            tableId: '=',
            config: '=',
            subscription: '='
        },
        controller: AlarmsTableWidgetController,
        controllerAs: 'vm',
        templateUrl: alarmsTableWidgetTemplate
    };
}

/*@ngInject*/
function AlarmsTableWidgetController($element, $scope, $filter, $mdMedia, $mdDialog, $document, $translate, $q, alarmService, utils, types) {
    var vm = this;

    vm.stylesInfo = {};
    vm.contentsInfo = {};
    vm.columnWidth = {};

    vm.showData = true;
    vm.hasData = false;

    vm.alarms = [];
    vm.alarmsCount = 0;
    vm.selectedAlarms = []

    vm.alarmSource = null;
    vm.allAlarms = null;

    vm.currentAlarm = null;

    vm.alarmsTitle = $translate.instant('alarm.alarms');
    vm.enableSelection = true;
    vm.enableSearch = true;
    vm.displayDetails = true;
    vm.allowAcknowledgment = true;
    vm.allowClear = true;
    vm.displayPagination = true;
    vm.defaultPageSize = 10;
    vm.defaultSortOrder = '-'+types.alarmFields.createdTime.value;

    vm.query = {
        order: vm.defaultSortOrder,
        limit: vm.defaultPageSize,
        page: 1,
        search: null
    };

    vm.enterFilterMode = enterFilterMode;
    vm.exitFilterMode = exitFilterMode;
    vm.onReorder = onReorder;
    vm.onPaginate = onPaginate;
    vm.onRowClick = onRowClick;
    vm.isCurrent = isCurrent;
    vm.openAlarmDetails = openAlarmDetails;
    vm.ackAlarms = ackAlarms;
    vm.clearAlarms = clearAlarms;

    vm.cellStyle = cellStyle;
    vm.cellContent = cellContent;

    $scope.$watch('vm.config', function() {
        if (vm.config) {
            vm.settings = vm.config.settings;
            vm.widgetConfig = vm.config.widgetConfig;
            initializeConfig();
        }
    });

    $scope.$watch("vm.query.search", function(newVal, prevVal) {
        if (!angular.equals(newVal, prevVal) && vm.query.search != null) {
            updateAlarms();
        }
    });

    $scope.$watch('vm.subscription', function() {
        if (vm.subscription) {
            vm.alarmSource = vm.subscription.alarmSource;
            updateAlarmSource();
        }
    });

    $scope.$on('alarms-table-data-updated', function(event, tableId) {
        if (vm.tableId == tableId) {
            if (vm.subscription) {
                vm.allAlarms = vm.subscription.alarms;
                updateAlarms(true);
                $scope.$digest();
            }
        }
    });

    $scope.$watch(function() { return $mdMedia('gt-xs'); }, function(isGtXs) {
        vm.isGtXs = isGtXs;
    });

    $scope.$watch(function() { return $mdMedia('gt-md'); }, function(isGtMd) {
        vm.isGtMd = isGtMd;
        if (vm.isGtMd) {
            vm.limitOptions = [vm.defaultPageSize, vm.defaultPageSize*2, vm.defaultPageSize*3];
        } else {
            vm.limitOptions = null;
        }
    });

    function initializeConfig() {

        if (vm.settings.alarmsTitle && vm.settings.alarmsTitle.length) {
            vm.alarmsTitle = vm.settings.alarmsTitle;
        }
        vm.enableSelection = angular.isDefined(vm.settings.enableSelection) ? vm.settings.enableSelection : true;
        vm.enableSearch = angular.isDefined(vm.settings.enableSearch) ? vm.settings.enableSearch : true;
        vm.displayDetails = angular.isDefined(vm.settings.displayDetails) ? vm.settings.displayDetails : true;
        vm.allowAcknowledgment = angular.isDefined(vm.settings.allowAcknowledgment) ? vm.settings.allowAcknowledgment : true;
        vm.allowClear = angular.isDefined(vm.settings.allowClear) ? vm.settings.allowClear : true;
        if (!vm.allowAcknowledgment && !vm.allowClear) {
            vm.enableSelection = false;
        }

        vm.displayPagination = angular.isDefined(vm.settings.displayPagination) ? vm.settings.displayPagination : true;

        var pageSize = vm.settings.defaultPageSize;
        if (angular.isDefined(pageSize) && Number.isInteger(pageSize) && pageSize > 0) {
            vm.defaultPageSize = pageSize;
        }

        if (vm.settings.defaultSortOrder && vm.settings.defaultSortOrder.length) {
            vm.defaultSortOrder = vm.settings.defaultSortOrder;
        }

        vm.query.order = vm.defaultSortOrder;
        vm.query.limit = vm.defaultPageSize;
        if (vm.isGtMd) {
            vm.limitOptions = [vm.defaultPageSize, vm.defaultPageSize*2, vm.defaultPageSize*3];
        } else {
            vm.limitOptions = null;
        }

        var origColor = vm.widgetConfig.color || 'rgba(0, 0, 0, 0.87)';
        var defaultColor = tinycolor(origColor);
        var mdDark = defaultColor.setAlpha(0.87).toRgbString();
        var mdDarkSecondary = defaultColor.setAlpha(0.54).toRgbString();
        var mdDarkDisabled = defaultColor.setAlpha(0.26).toRgbString();
        //var mdDarkIcon = mdDarkSecondary;
        var mdDarkDivider = defaultColor.setAlpha(0.12).toRgbString();

        var cssString = 'table.md-table th.md-column {\n'+
            'color: ' + mdDarkSecondary + ';\n'+
            '}\n'+
            'table.md-table th.md-column md-icon.md-sort-icon {\n'+
            'color: ' + mdDarkDisabled + ';\n'+
            '}\n'+
            'table.md-table th.md-column.md-active, table.md-table th.md-column.md-active md-icon {\n'+
            'color: ' + mdDark + ';\n'+
            '}\n'+
            'table.md-table td.md-cell {\n'+
            'color: ' + mdDark + ';\n'+
            'border-top: 1px '+mdDarkDivider+' solid;\n'+
            '}\n'+
            'table.md-table td.md-cell.md-placeholder {\n'+
            'color: ' + mdDarkDisabled + ';\n'+
            '}\n'+
            'table.md-table td.md-cell md-select > .md-select-value > span.md-select-icon {\n'+
            'color: ' + mdDarkSecondary + ';\n'+
            '}\n'+
            '.md-table-pagination {\n'+
            'color: ' + mdDarkSecondary + ';\n'+
            'border-top: 1px '+mdDarkDivider+' solid;\n'+
            '}\n'+
            '.md-table-pagination .buttons md-icon {\n'+
            'color: ' + mdDarkSecondary + ';\n'+
            '}\n'+
            '.md-table-pagination md-select:not([disabled]):focus .md-select-value {\n'+
            'color: ' + mdDarkSecondary + ';\n'+
            '}';

        var cssParser = new cssjs();
        cssParser.testMode = false;
        var namespace = 'ts-table-' + hashCode(cssString);
        cssParser.cssPreviewNamespace = namespace;
        cssParser.createStyleElement(namespace, cssString);
        $element.addClass(namespace);

        function hashCode(str) {
            var hash = 0;
            var i, char;
            if (str.length === 0) return hash;
            for (i = 0; i < str.length; i++) {
                char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash;
        }
    }

    function enterFilterMode () {
        vm.query.search = '';
    }

    function exitFilterMode () {
        vm.query.search = null;
        updateAlarms();
    }

    function onReorder () {
        updateAlarms();
    }

    function onPaginate () {
        updateAlarms();
    }

    function onRowClick($event, alarm) {
        if (vm.currentAlarm != alarm) {
            vm.currentAlarm = alarm;
        }
    }

    function isCurrent(alarm) {
        return (vm.currentAlarm && alarm && vm.currentAlarm.id && alarm.id) &&
            (vm.currentAlarm.id.id === alarm.id.id);
    }

    function openAlarmDetails($event, alarm) {
        if (alarm && alarm.id) {
            var onShowingCallback = {
                onShowing: function(){}
            }
            $mdDialog.show({
                controller: 'AlarmDetailsDialogController',
                controllerAs: 'vm',
                templateUrl: alarmDetailsDialogTemplate,
                locals: {
                    alarmId: alarm.id.id,
                    allowAcknowledgment: vm.allowAcknowledgment,
                    allowClear: vm.allowClear,
                    showingCallback: onShowingCallback
                },
                parent: angular.element($document[0].body),
                targetEvent: $event,
                fullscreen: true,
                skipHide: true,
                onShowing: function(scope, element) {
                    onShowingCallback.onShowing(scope, element);
                }
            }).then(function (alarm) {
                if (alarm) {
                    vm.subscription.update();
                }
            });

        }
    }

    function ackAlarms($event) {
        if ($event) {
            $event.stopPropagation();
        }
        if (vm.selectedAlarms && vm.selectedAlarms.length > 0) {
            var title = $translate.instant('alarm.aknowledge-alarms-title', {count: vm.selectedAlarms.length}, 'messageformat');
            var content = $translate.instant('alarm.aknowledge-alarms-text', {count: vm.selectedAlarms.length}, 'messageformat');
            var confirm = $mdDialog.confirm()
                .targetEvent($event)
                .title(title)
                .htmlContent(content)
                .ariaLabel(title)
                .cancel($translate.instant('action.no'))
                .ok($translate.instant('action.yes'));
            $mdDialog.show(confirm).then(function () {
                var tasks = [];
                for (var i=0;i<vm.selectedAlarms.length;i++) {
                    var alarm = vm.selectedAlarms[i];
                    if (alarm.id) {
                        tasks.push(alarmService.ackAlarm(alarm.id.id));
                    }
                }
                if (tasks.length) {
                    $q.all(tasks).then(function () {
                        vm.selectedAlarms = [];
                        vm.subscription.update();
                    });
                }

            });
        }
    }

    function clearAlarms($event) {
        if ($event) {
            $event.stopPropagation();
        }
        if (vm.selectedAlarms && vm.selectedAlarms.length > 0) {
            var title = $translate.instant('alarm.clear-alarms-title', {count: vm.selectedAlarms.length}, 'messageformat');
            var content = $translate.instant('alarm.clear-alarms-text', {count: vm.selectedAlarms.length}, 'messageformat');
            var confirm = $mdDialog.confirm()
                .targetEvent($event)
                .title(title)
                .htmlContent(content)
                .ariaLabel(title)
                .cancel($translate.instant('action.no'))
                .ok($translate.instant('action.yes'));
            $mdDialog.show(confirm).then(function () {
                var tasks = [];
                for (var i=0;i<vm.selectedAlarms.length;i++) {
                    var alarm = vm.selectedAlarms[i];
                    if (alarm.id) {
                        tasks.push(alarmService.clearAlarm(alarm.id.id));
                    }
                }
                if (tasks.length) {
                    $q.all(tasks).then(function () {
                        vm.selectedAlarms = [];
                        vm.subscription.update();
                    });
                }

            });
        }
    }


    function updateAlarms(preserveSelections) {
        if (!preserveSelections) {
            vm.selectedAlarms = [];
        }
        var result = $filter('orderBy')(vm.allAlarms, vm.query.order);
        if (vm.query.search != null) {
            result = $filter('filter')(result, {$: vm.query.search});
        }
        vm.alarmsCount = result.length;

        if (vm.displayPagination) {
            var startIndex = vm.query.limit * (vm.query.page - 1);
            vm.alarms = result.slice(startIndex, startIndex + vm.query.limit);
        } else {
            vm.alarms = result;
        }

        if (preserveSelections) {
            var newSelectedAlarms = [];
            if (vm.selectedAlarms && vm.selectedAlarms.length) {
                var i = vm.selectedAlarms.length;
                while (i--) {
                    var selectedAlarm = vm.selectedAlarms[i];
                    if (selectedAlarm.id) {
                        result = $filter('filter')(vm.alarms, {id: {id: selectedAlarm.id.id} });
                        if (result && result.length) {
                            newSelectedAlarms.push(result[0]);
                        }
                    }
                }
            }
            vm.selectedAlarms = newSelectedAlarms;
        }
    }

    function cellStyle(alarm, key) {
        var style = {};
        if (alarm && key) {
            var styleInfo = vm.stylesInfo[key.label];
            var value = getAlarmValue(alarm, key);
            if (styleInfo.useCellStyleFunction && styleInfo.cellStyleFunction) {
                try {
                    style = styleInfo.cellStyleFunction(value);
                } catch (e) {
                    style = {};
                }
            } else {
                style = defaultStyle(key, value);
            }
        }
        if (!style.width) {
            var columnWidth = vm.columnWidth[key.label];
            style.width = columnWidth;
        }
        return style;
    }

    function cellContent(alarm, key) {
        var strContent = '';
        if (alarm && key) {
            var contentInfo = vm.contentsInfo[key.label];
            var value = getAlarmValue(alarm, key);
            if (contentInfo.useCellContentFunction && contentInfo.cellContentFunction) {
                if (angular.isDefined(value)) {
                    strContent = '' + value;
                }
                var content = strContent;
                try {
                    content = contentInfo.cellContentFunction(value, alarm, $filter);
                } catch (e) {
                    content = strContent;
                }
            } else {
                content = defaultContent(key, value);
            }
            return content;
        } else {
            return strContent;
        }
    }

    function defaultContent(key, value) {
        if (angular.isDefined(value)) {
            var alarmField = types.alarmFields[key.name];
            if (alarmField) {
                if (alarmField.time) {
                    return $filter('date')(value, 'yyyy-MM-dd HH:mm:ss');
                } else if (alarmField.value == types.alarmFields.severity.value) {
                    return $translate.instant(types.alarmSeverity[value].name);
                } else if (alarmField.value == types.alarmFields.status.value) {
                    return $translate.instant('alarm.display-status.'+value);
                } else if (alarmField.value == types.alarmFields.originatorType.value) {
                    return $translate.instant(types.entityTypeTranslations[value].type);
                }
                else {
                    return value;
                }
            } else {
                return value;
            }
        } else {
            return '';
        }
    }
    function defaultStyle(key, value) {
        if (angular.isDefined(value)) {
            var alarmField = types.alarmFields[key.name];
            if (alarmField) {
                if (alarmField.value == types.alarmFields.severity.value) {
                    return {
                        fontWeight: 'bold',
                        color: types.alarmSeverity[value].color
                    };
                } else {
                    return {};
                }
            } else {
                return {};
            }
        } else {
            return {};
        }
    }

    const getDescendantProp = (obj, path) => (
        path.split('.').reduce((acc, part) => acc && acc[part], obj)
    );

    function getAlarmValue(alarm, key) {
        var alarmField = types.alarmFields[key.name];
        if (alarmField) {
            return getDescendantProp(alarm, alarmField.value);
        } else {
            return getDescendantProp(alarm, key.name);
        }
    }

    function updateAlarmSource() {

        if (vm.settings.alarmsTitle && vm.settings.alarmsTitle.length) {
            vm.alarmsTitle = utils.createLabelFromDatasource(vm.alarmSource, vm.settings.alarmsTitle);
        }

        vm.stylesInfo = {};
        vm.contentsInfo = {};
        vm.columnWidth = {};

        for (var d = 0; d < vm.alarmSource.dataKeys.length; d++ ) {
            var dataKey = vm.alarmSource.dataKeys[d];

            var translationId = types.translate.keyLabelPrefix + dataKey.label;
            var translation = $translate.instant(translationId);
            if (translation != translationId) {
                dataKey.title = translation;
            } else {
                dataKey.title = dataKey.label;
            }

            var keySettings = dataKey.settings;

            var cellStyleFunction = null;
            var useCellStyleFunction = false;

            if (keySettings.useCellStyleFunction === true) {
                if (angular.isDefined(keySettings.cellStyleFunction) && keySettings.cellStyleFunction.length > 0) {
                    try {
                        cellStyleFunction = new Function('value', keySettings.cellStyleFunction);
                        useCellStyleFunction = true;
                    } catch (e) {
                        cellStyleFunction = null;
                        useCellStyleFunction = false;
                    }
                }
            }

            vm.stylesInfo[dataKey.label] = {
                useCellStyleFunction: useCellStyleFunction,
                cellStyleFunction: cellStyleFunction
            };

            var cellContentFunction = null;
            var useCellContentFunction = false;

            if (keySettings.useCellContentFunction === true) {
                if (angular.isDefined(keySettings.cellContentFunction) && keySettings.cellContentFunction.length > 0) {
                    try {
                        cellContentFunction = new Function('value, alarm, filter', keySettings.cellContentFunction);
                        useCellContentFunction = true;
                    } catch (e) {
                        cellContentFunction = null;
                        useCellContentFunction = false;
                    }
                }
            }

            vm.contentsInfo[dataKey.label] = {
                useCellContentFunction: useCellContentFunction,
                cellContentFunction: cellContentFunction
            };

            var columnWidth = angular.isDefined(keySettings.columnWidth) ? keySettings.columnWidth : '0px';
            vm.columnWidth[dataKey.label] = columnWidth;
        }
    }

}