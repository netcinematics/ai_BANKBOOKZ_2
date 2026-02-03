/*!
* @license
* chartjs-chart-financial
* http://chartjs.org/
* Version: 0.2.0
*
* Copyright 2024 Chart.js Contributors
* Released under the MIT license
* https://github.com/chartjs/chartjs-chart-financial/blob/master/LICENSE.md
*/
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('chart.js'), require('chart.js/helpers')) :
        typeof define === 'function' && define.amd ? define(['chart.js', 'chart.js/helpers'], factory) :
            (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Chart, global.Chart.helpers));
})(this, (function (chart_js, helpers) {
    'use strict';

    /**
     * This class is based off controller.bar.js from the upstream Chart.js library
     */
    class FinancialController extends chart_js.BarController {
        static overrides = {
            label: '',
            parsing: false,
            hover: {
                mode: 'label'
            },
            animations: {
                numbers: {
                    type: 'number',
                    properties: ['x', 'y', 'base', 'width', 'open', 'high', 'low', 'close']
                }
            },
            scales: {
                x: {
                    type: 'timeseries',
                    offset: true,
                    ticks: {
                        major: {
                            enabled: true,
                        },
                        source: 'data',
                        maxRotation: 0,
                        autoSkip: true,
                        autoSkipPadding: 75,
                        sampleSize: 100
                    },
                    grid: {
                        color: 'rgba(0,10,23, 1)', // Set the grid color (adjust transparency as needed)
                    }
                },
                y: {
                    type: 'linear',
                    grid: {
                        color: 'rgba(0,10,23, 1)', // Set the grid color (adjust transparency as needed)
                    }
                }
            },
            plugins: {
                tooltip: {
                    intersect: false,
                    mode: 'index',
                    callbacks: {
                        label(ctx) {
                            const point = ctx.parsed;
                            if (!helpers.isNullOrUndef(point.y)) {
                                return chart_js.defaults.plugins.tooltip.callbacks.label(ctx);
                            }
                            const { o, h, l, c } = point;
                            return `O: ${o}  H: ${h}  L: ${l}  C: ${c}`;
                        }
                    }
                }
            }
        };
        getLabelAndValue(index) {
            const me = this;
            const parsed = me.getParsed(index);
            const axis = me._cachedMeta.iScale.axis;
            const { o, h, l, c } = parsed;
            const value = `O: ${o}  H: ${h}  L: ${l}  C: ${c}`;
            return {
                label: `${me._cachedMeta.iScale.getLabelForValue(parsed[axis])}`,
                value
            };
        }
        getUserBounds(scale) {
            const { min, max, minDefined, maxDefined } = scale.getUserBounds();
            return {
                min: minDefined ? min : Number.NEGATIVE_INFINITY,
                max: maxDefined ? max : Number.POSITIVE_INFINITY
            };
        }
        /**
         * Implement this ourselves since it doesn't handle high and low values
         * https://github.com/chartjs/Chart.js/issues/7328
         * @protected
         */
        getMinMax(scale) {
            const meta = this._cachedMeta;
            const _parsed = meta._parsed;
            const axis = meta.iScale.axis;
            const otherScale = this._getOtherScale(scale);
            const { min: otherMin, max: otherMax } = this.getUserBounds(otherScale);
            if (_parsed.length < 2) {
                return { min: 0, max: 1 };
            }
            if (scale === meta.iScale) {
                return { min: _parsed[0][axis], max: _parsed[_parsed.length - 1][axis] };
            }
            const newParsedData = _parsed.filter(({ x }) => x >= otherMin && x < otherMax);
            let min = Number.POSITIVE_INFINITY;
            let max = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < newParsedData.length; i++) {
                const data = newParsedData[i];
                min = Math.min(min, data.l);
                max = Math.max(max, data.h);
            }
            return { min, max };
        }
        /**
         * @protected
         */
        calculateElementProperties(index, ruler, reset, options) {
            const me = this;
            const vscale = me._cachedMeta.vScale;
            const base = vscale.getBasePixel();
            const ipixels = me._calculateBarIndexPixels(index, ruler, options);
            const data = me.chart.data.datasets[me.index].data[index];
            const open = vscale.getPixelForValue(data.o);
            const high = vscale.getPixelForValue(data.h);
            const low = vscale.getPixelForValue(data.l);
            const close = vscale.getPixelForValue(data.c);
            return {
                base: reset ? base : low,
                x: ipixels.center,
                y: (low + high) / 2,
                width: ipixels.size,
                open,
                high,
                low,
                close
            };
        }
        draw() {
            const me = this;
            const chart = me.chart;
            const rects = me._cachedMeta.data;
            helpers.clipArea(chart.ctx, chart.chartArea);
            for (let i = 0; i < rects.length; ++i) {
                rects[i].draw(me._ctx);
            }
            helpers.unclipArea(chart.ctx);
        }
    }
    /**
     * Helper function to get the bounds of the bar regardless of the orientation
     * @param {Rectangle} bar the bar
     * @param {boolean} [useFinalPosition]
     * @return {object} bounds of the bar
     * @private
     */
    function getBarBounds(bar, useFinalPosition) {
        const { x, y, base, width, height } = bar.getProps(['x', 'low', 'high', 'width', 'height'], useFinalPosition);
        let left, right, top, bottom, half;
        if (bar.horizontal) {
            half = height / 2;
            left = Math.min(x, base);
            right = Math.max(x, base);
            top = y - half;
            bottom = y + half;
        } else {
            half = width / 2;
            left = x - half;
            right = x + half;
            top = Math.min(y, base); // use min because 0 pixel at top of screen
            bottom = Math.max(y, base);
        }
        return { left, top, right, bottom };
    }
    function inRange(bar, x, y, useFinalPosition) {
        const skipX = x === null;
        const skipY = y === null;
        const bounds = !bar || (skipX && skipY) ? false : getBarBounds(bar, useFinalPosition);
        return bounds
            && (skipX || x >= bounds.left && x <= bounds.right)
            && (skipY || y >= bounds.top && y <= bounds.bottom);
    }
    class FinancialElement extends chart_js.BarElement {
        static defaults = {
            backgroundColors: {
                up: 'rgba(75, 192, 192, 1)',
                down: 'rgba(255, 99, 132, 1)',
                unchanged: 'rgba(201, 203, 207,1)',
            },
            borderColors: {
                up: 'rgb(75, 192, 192)',
                down: 'rgb(255, 99, 132)',
                unchanged: 'rgb(201, 203, 207)',
            }
        };
        height() {
            return this.base - this.y;
        }
        inRange(mouseX, mouseY, useFinalPosition) {
            return inRange(this, mouseX, mouseY, useFinalPosition);
        }
        inXRange(mouseX, useFinalPosition) {
            return inRange(this, mouseX, null, useFinalPosition);
        }
        inYRange(mouseY, useFinalPosition) {
            return inRange(this, null, mouseY, useFinalPosition);
        }
        getRange(axis) {
            return axis === 'x' ? this.width / 2 : this.height / 2;
        }
        getCenterPoint(useFinalPosition) {
            const { x, low, high } = this.getProps(['x', 'low', 'high'], useFinalPosition);
            return {
                x,
                y: (high + low) / 2
            };
        }
        tooltipPosition(useFinalPosition) {
            const { x, open, close } = this.getProps(['x', 'open', 'close'], useFinalPosition);
            return {
                x,
                y: (open + close) / 2
            };
        }
    }
    class CandlestickElement extends FinancialElement {
        static id = 'candlestick';
        static defaults = {
            ...FinancialElement.defaults,
            borderWidth: 1,
        };
        draw(ctx) {
            const me = this;
            const { x, open, high, low, close } = me;
            let borderColors = me.options.borderColors;
            if (typeof borderColors === 'string') {
                borderColors = {
                    up: borderColors,
                    down: borderColors,
                    unchanged: borderColors
                };
            }
            let borderColor;
            if (close < open) {
                borderColor = helpers.valueOrDefault(borderColors ? borderColors.up : undefined, chart_js.defaults.elements.candlestick.borderColors.up);
                ctx.fillStyle = helpers.valueOrDefault(me.options.backgroundColors ? me.options.backgroundColors.up : undefined, chart_js.defaults.elements.candlestick.backgroundColors.up);
            } else if (close > open) {
                borderColor = helpers.valueOrDefault(borderColors ? borderColors.down : undefined, chart_js.defaults.elements.candlestick.borderColors.down);
                ctx.fillStyle = helpers.valueOrDefault(me.options.backgroundColors ? me.options.backgroundColors.down : undefined, chart_js.defaults.elements.candlestick.backgroundColors.down);
            } else {
                borderColor = helpers.valueOrDefault(borderColors ? borderColors.unchanged : undefined, chart_js.defaults.elements.candlestick.borderColors.unchanged);
                ctx.fillStyle = helpers.valueOrDefault(me.backgroundColors ? me.backgroundColors.unchanged : undefined, chart_js.defaults.elements.candlestick.backgroundColors.unchanged);
            }
            ctx.lineWidth = helpers.valueOrDefault(me.options.borderWidth, chart_js.defaults.elements.candlestick.borderWidth);
            ctx.strokeStyle = borderColor;
            ctx.beginPath();
            ctx.moveTo(x, high);
            ctx.lineTo(x, Math.min(open, close));
            ctx.moveTo(x, low);
            ctx.lineTo(x, Math.max(open, close));
            ctx.stroke();
            ctx.fillRect(x - me.width / 2, close, me.width, open - close);
            ctx.strokeRect(x - me.width / 2, close, me.width, open - close);
            ctx.closePath();
        }
    }
    class CandlestickController extends FinancialController {
        static id = 'candlestick';
        static defaults = {
            ...FinancialController.defaults,
            dataElementType: CandlestickElement.id
        };
        static defaultRoutes = chart_js.BarController.defaultRoutes;
        updateElements(elements, start, count, mode) {
            const reset = mode === 'reset';
            const ruler = this._getRuler();
            const { sharedOptions, includeOptions } = this._getSharedOptions(start, mode);
            for (let i = start; i < start + count; i++) {
                const options = sharedOptions || this.resolveDataElementOptions(i, mode);
                const baseProperties = this.calculateElementProperties(i, ruler, reset, options);
                if (includeOptions) {
                    baseProperties.options = options;
                }
                this.updateElement(elements[i], i, baseProperties, mode);
            }
        }
    }
    const defaults = chart_js.Chart.defaults;
    class OhlcElement extends FinancialElement {
        static id = 'ohlc';
        static defaults = {
            ...FinancialElement.defaults,
            lineWidth: 2,
            armLength: null,
            armLengthRatio: 0.8
        };
        draw(ctx) {
            const me = this;
            const { x, open, high, low, close } = me;
            const armLengthRatio = helpers.valueOrDefault(me.armLengthRatio, defaults.elements.ohlc.armLengthRatio);
            let armLength = helpers.valueOrDefault(me.armLength, defaults.elements.ohlc.armLength);
            if (armLength === null) {
                // The width of an ohlc is affected by barPercentage and categoryPercentage
                // This behavior is caused by extending controller.financial, which extends controller.bar
                // barPercentage and categoryPercentage are now set to 1.0 (see controller.ohlc)
                // and armLengthRatio is multipled by 0.5,
                // so that when armLengthRatio=1.0, the arms from neighbour ohcl touch,
                // and when armLengthRatio=0.0, ohcl are just vertical lines.
                armLength = me.width * armLengthRatio * 0.5;
            }
            if (close < open) {
                ctx.strokeStyle = helpers.valueOrDefault(me.options.borderColors ? me.options.borderColors.up : undefined, defaults.elements.ohlc.borderColors.up);
            } else if (close > open) {
                ctx.strokeStyle = helpers.valueOrDefault(me.options.borderColors ? me.options.borderColors.down : undefined, defaults.elements.ohlc.borderColors.down);
            } else {
                ctx.strokeStyle = helpers.valueOrDefault(me.options.borderColors ? me.options.borderColors.unchanged : undefined, defaults.elements.ohlc.borderColors.unchanged);
            }
            ctx.lineWidth = helpers.valueOrDefault(me.lineWidth, defaults.elements.ohlc.lineWidth);
            ctx.beginPath();
            ctx.moveTo(x, high);
            ctx.lineTo(x, low);
            ctx.moveTo(x - armLength, open);
            ctx.lineTo(x, open);
            ctx.moveTo(x + armLength, close);
            ctx.lineTo(x, close);
            ctx.stroke();
        }
    }
    class OhlcController extends FinancialController {
        static id = 'ohlc';
        static defaults = {
            ...FinancialController.defaults,
            dataElementType: OhlcElement.id,
            datasets: {
                barPercentage: 1.0,
                categoryPercentage: 1.0
            }
        };
        updateElements(elements, start, count, mode) {
            const reset = mode === 'reset';
            const ruler = this._getRuler();
            const { sharedOptions, includeOptions } = this._getSharedOptions(start, mode);
            for (let i = start; i < start + count; i++) {
                const options = sharedOptions || this.resolveDataElementOptions(i, mode);
                const baseProperties = this.calculateElementProperties(i, ruler, reset, options);
                if (includeOptions) {
                    baseProperties.options = options;
                }
                this.updateElement(elements[i], i, baseProperties, mode);
            }
        }
    }
    chart_js.Chart.register(CandlestickController, OhlcController, CandlestickElement, OhlcElement);
}));
// End of Library

//INIT-------------------------------------------------------
var barCount = 60;
var barData = new Array(barCount);
var lineData = new Array(barCount);
var initialDateStr = new Date().toUTCString();
const canvasChart = document.getElementById('finChart');
var TKRChart1, TKRChart2; //unique handles for concurrent chart instances.
var chartElem1, chartElem2, ctx1, ctx2; //handles for internals.
const initTKRChart1 = () => {
    let chartElem1 = Chart.getChart(canvasChart); // Check if a chart already exists on the canvas
    if (chartElem1) {  // Destroy the existing chart if any
        chartElem1.destroy();
    }
    ctx1 = canvasChart.getContext('2d');
    ctx1.canvas.width = 1000;
    if (!ai_viewz.chart_expanded) { //expand_CHART
        ctx1.canvas.height = 444; //small
        console.log('Rendering:', 'small')
    } else if (ai_viewz.chart_expanded) {
        ctx1.canvas.height = 777; //big
        console.log('Rendering:', 'big')
    } else {
        ctx1.canvas.height = 666; //default
        console.log('Rendering:', 'default')
    }
    getRandomData(initialDateStr);
    // lineData[1] = {x: 1718999820000, y: 29.62}
    // barData[1] = {x: 1718999820000, o: 28.43, h: 30.36, l: 28.19, c: 29.62}

    // debugger;
    TKRChart1 = new Chart(ctx1,
        {
            type: 'candlestick',
            data: {
                datasets: [
                    { label: 'TKR', data: barData },
                    { label: 'Close', type: 'line', data: lineData, hidden: false }
                ]
            }
        });
}; //initTKRChart1();
const getChartData = () => {
    let dataset = [];
    let tgtYMTID = '2024_6_BTC', txn, ymdARR, tgtYR, tgtMO, tgtDAY, dateYMD, stampUTC;
    for (var j = 0; j < ai_bankbookz_2.ymt_MonthlyMap[tgtYMTID].length; j++) { //TRANSACTIONS.
        txn = ai_bankbookz_2.ymt_MonthlyMap[tgtYMTID][j];
        ymdARR = txn.ymd.split('_');
        tgtYR = ymdARR[0];
        tgtMO = ymdARR[1] - 1;//month is zero based.
        tgtDAY = ymdARR[2];
        dateYMD = new Date(tgtYR, tgtMO, tgtDAY);
        stampUTC = dateYMD.getTime();
        // dataset.push({x:stampUTC,y:txn.price})
        dataset.push({ x: stampUTC.toString(), y: parseFloat(txn.price.replace(/,/g, '')) })
        // parseFloat(point.y.replace(/,/g, '')); // Convert string to number, replacing commas
        console.log({ x: stampUTC, y: txn.price })
    }

    return dataset;
}
const initTKRChart2 = () => {
    let chartElem1 = Chart.getChart(canvasChart); // Check if a chart already exists on the canvas
    if (chartElem1) {  // Destroy the existing chart if any
        chartElem1.destroy();
    }
    ctx1 = canvasChart.getContext('2d');
    ctx1.canvas.width = 1000;
    if (!ai_viewz.chart_expanded) { //expand_CHART
        ctx1.canvas.height = 444; //small
        console.log('Rendering:', 'small')
    } else if (ai_viewz.chart_expanded) {
        ctx1.canvas.height = 777; //big
        console.log('Rendering:', 'big')
    } else {
        ctx1.canvas.height = 666; //default
        console.log('Rendering:', 'default')
    }
    getRandomData(initialDateStr);
    // lineData[1] = {x: 1718999820000, y: 29.62}
    // barData[1] = {x: 1718999820000, o: 28.43, h: 30.36, l: 28.19, c: 29.62}

    // debugger;
    let btcData = getChartData()
    TKRChart1 = new Chart(ctx1,
        {
            // type: 'candlestick',
            type: 'line',
            data: {
                datasets: [
                    { label: 'BTC', data: btcData }
                    // { label: 'TKR', data: barData }, 
                    // { label: 'Close', type: 'line', data: lineData, hidden: false }
                ]
            }
        });
}; //initTKRChart2();

//UTILITIES---------------------------------------------------------
function randomNumber(min, max) {
    return Math.random() * (max - min) + min;
}
function randomBar(target, index, date, lastClose) {
    var open = +randomNumber(lastClose * 0.95, lastClose * 1.05).toFixed(2);
    var close = +randomNumber(open * 0.95, open * 1.05).toFixed(2);
    var high = +randomNumber(Math.max(open, close), Math.max(open, close) * 1.1).toFixed(2);
    var low = +randomNumber(Math.min(open, close) * 0.9, Math.min(open, close)).toFixed(2);
    if (!target[index]) {
        target[index] = {};
    }
    Object.assign(target[index], {
        x: date.valueOf(),
        o: open,
        h: high,
        l: low,
        c: close
    });
}
function getRandomData(dateStr) {
    var date = luxon.DateTime.fromRFC2822(dateStr);
    for (let i = 0; i < barData.length;) {
        date = date.plus({ days: 1 });
        if (date.weekday <= 5) {
            randomBar(barData, i, date, i === 0 ? 30 : barData[i - 1].c);
            lineData[i] = { x: barData[i].x, y: barData[i].c };
            i++;
        }
    }
}
//UPDATE----------------------------------------------------------------
var updateTKRChart1 = function () {
    var dataset = TKRChart1.config.data.datasets[0];
    var type = document.getElementById('type').value; // candlestick vs ohlc
    TKRChart1.config.type = type;
    var scaleType = document.getElementById('scale-type').value; // linear vs log
    TKRChart1.config.options.scales.y.type = scaleType;
    var colorScheme = document.getElementById('color-scheme').value; // color
    colorScheme = 'neon'
    if (colorScheme === 'neon') {
        TKRChart1.config.data.datasets[0].backgroundColors = {
            up: '#01ff01', //green
            down: '#fe0000', //red
            unchanged: '#999', //white
        };
    } else { delete TKRChart1.config.data.datasets[0].backgroundColors; }
    var border = document.getElementById('border').value; // border
    if (border === 'false') { dataset.borderColors = 'rgba(0, 0, 0, 0)'; } else { delete dataset.borderColors; }
    // mixed charts
    //   var mixed = document.getElementById('mixed').value;
    //   if (mixed === 'true') {
    //     TKRChart1.config.data.datasets[1].hidden = false;
    //   } else {
    //     TKRChart1.config.data.datasets[1].hidden = true;
    //   }
    TKRChart1.update();
};
[...document.getElementsByTagName('select')].forEach( //updateTKRChart1() on each SELECT change
    element => element.addEventListener('change', updateTKRChart1));
// document.getElementById('updateBtn').addEventListener('click', updateTKRChart1);
document.getElementById('randomizeData').addEventListener('click', function () {
    getRandomData(initialDateStr, barData);
    updateTKRChart1();
}); //updateTKRChart1(); //init default
// End of Init Script
// Start of Chart Implementations
function show_Random_Chart() {
    getRandomData(initialDateStr, barData);
    updateTKRChart1(); //legacy chart for demonstration
}

var updateSelections = function () {
    let selection = ymt_SELECTOR.value, tgt, found = false;
    if (selection === '...') {
        CHART_SELECTIONS = [];
        selectionOutput.innerHTML = '...'
        return;
    }
    for (var i = 0; i < CHART_SELECTIONS.length; i++) {
        tgt = CHART_SELECTIONS[i];
        if (selection === tgt) {//found remove
            found = true;
            CHART_SELECTIONS.splice(i, 1)
            break;
        }
    }
    if (!found) {//add
        CHART_SELECTIONS.push(selection)
    }
    if (CHART_SELECTIONS.length < 1) {
        selectionOutput.innerHTML = '...';
    } else {
        selectionOutput.innerHTML = CHART_SELECTIONS.join(', ');
    }
}

var updateTKRChart2 = function () { //FIRST DATA OVERRIDE.

    var dataset = TKRChart1.config.data.datasets[0];
    // var dataset2 = TKRChart1.config.data.datasets[1];
    // debugger;
    // dataset2.data = [{"x":1718922789000,"y":29.84},{"x":1719009189000,"y":29.96},{"x":1719268389000,"y":31.78},{"x":1719354789000,"y":31.75},{"x":1719441189000,"y":31.24},{"x":1719527589000,"y":31.24},{"x":1719613989000,"y":32.46},{"x":1719873189000,"y":33.06},{"x":1719959589000,"y":31.92},{"x":1720045989000,"y":33.37},{"x":1720132389000,"y":34.64},{"x":1720218789000,"y":37.28},{"x":1720477989000,"y":35.6},{"x":1720564389000,"y":37},{"x":1720650789000,"y":35.39},{"x":1720737189000,"y":37.35},{"x":1720823589000,"y":35.84},{"x":1721082789000,"y":36.9},{"x":1721169189000,"y":35.62},{"x":1721255589000,"y":36.29},{"x":1721341989000,"y":39.71},{"x":1721428389000,"y":39.13},{"x":1721687589000,"y":36.8},{"x":1721773989000,"y":36.51},{"x":1721860389000,"y":33.99},{"x":1721946789000,"y":32.54},{"x":1722033189000,"y":30.68},{"x":1722292389000,"y":30.44},{"x":1722378789000,"y":29.18},{"x":1722465189000,"y":28.29},{"x":1722551589000,"y":29.43},{"x":1722637989000,"y":30.23},{"x":1722897189000,"y":30.63},{"x":1722983589000,"y":32.73},{"x":1723069989000,"y":34.54},{"x":1723156389000,"y":35.76},{"x":1723242789000,"y":35.36},{"x":1723501989000,"y":33.92},{"x":1723588389000,"y":35.58},{"x":1723674789000,"y":37.06},{"x":1723761189000,"y":36.3},{"x":1723847589000,"y":35.29},{"x":1724106789000,"y":35.58},{"x":1724193189000,"y":36.69},{"x":1724279589000,"y":36.51},{"x":1724365989000,"y":35.39},{"x":1724452389000,"y":35.08},{"x":1724711589000,"y":35.83},{"x":1724797989000,"y":37.23},{"x":1724884389000,"y":37.44},{"x":1724970789000,"y":35.7},{"x":1725057189000,"y":35.49},{"x":1725316389000,"y":35.66},{"x":1725402789000,"y":35.28},{"x":1725489189000,"y":33.47},{"x":1725575589000,"y":32.86},{"x":1725661989000,"y":35.12},{"x":1725921189000,"y":34.99},{"x":1726007589000,"y":36.64},{"x":1726093989000,"y":36.08}]
    dataset.data = getDataForChart();
    // dataset2.data = getDataForChart();

    var type = document.getElementById('type').value; // candlestick vs ohlc
    TKRChart1.config.type = type;
    var scaleType = document.getElementById('scale-type').value; // linear vs log
    TKRChart1.config.options.scales.y.type = scaleType;
    var colorScheme = document.getElementById('color-scheme').value; // color
    colorScheme = 'neon'
    if (colorScheme === 'neon') {
        TKRChart1.config.data.datasets[0].backgroundColors = {
            up: '#01ff01', //green
            down: '#fe0000', //red
            unchanged: '#999', //white
        };
    } else { delete TKRChart1.config.data.datasets[0].backgroundColors; }
    var border = document.getElementById('border').value; // border
    if (border === 'false') { dataset.borderColors = 'rgba(0, 0, 0, 0)'; } else { delete dataset.borderColors; }
    // mixed charts
    var mixed = document.getElementById('mixed').value;
    if (mixed === 'true') {
        TKRChart1.config.data.datasets[1].hidden = false;
    } else {
        TKRChart1.config.data.datasets[1].hidden = true;
    }
    TKRChart1.update();
};


function getDataForChart() {
    // debugger;
    // lineData[1] = {x: 1718999820000, y: 29.62}
    // barData[1] = {x: 1718999820000, o: 28.43, h: 30.36, l: 28.19, c: 29.62}
    let dataset = [];
    let tgtYMTID, txn, ymdARR, tgtYR, tgtMO, tgtDAY, dateYMD; //UTC TIMESTAMPS & PRICE
    for (var i = 0; i < CHART_SELECTIONS.length; i++) { //MONTH SELECTIONS.
        tgtYMTID = CHART_SELECTIONS[i];
        for (var j = 0; j < ai_bankbookz_2.ymt_MonthlyMap[tgtYMTID].length; j++) { //TRANSACTIONS.
            txn = ai_bankbookz_2.ymt_MonthlyMap[tgtYMTID][j];
            ymdARR = txn.ymd.split('_');
            tgtYR = ymdARR[0];
            tgtMO = ymdARR[1] - 1;//month is zero based.
            tgtDAY = ymdARR[2];
            dateYMD = new Date(tgtYR, tgtMO, tgtDAY);
            stampUTC = dateYMD.getTime();
            dataset.push({ x: stampUTC, y: txn.price })
        }
        break;
    }
    return dataset;
    // return TKRChart1.config.data.datasets[0];
}

function formatCryptoDaily_to_ChartJS(tickDaily) {
    debugger;

}
// End of Chart Implementations
// Start of Crypto API

let stock_api_key = null;//API_KEY - set in local storage.
let keyBOX = document.getElementById('keyBOX');
let keyINPUT = document.getElementById('keyINPUT');

let init_api_key = () => {
    if (localStorage.stock_api_key) {
        stock_api_key = localStorage.stock_api_key;
        let status = document.getElementById('connectStatus')
        status.innerHTML = 'CONNECTED'
    }
}; init_api_key();

let setAPIKEY = () => {
    if (keyINPUT.value) {
        stock_api_key = keyINPUT.value;
        localStorage.stock_api_key = stock_api_key;
        let status = document.getElementById('connectStatus')
        status.innerHTML = 'CONNECTED'
    }
};

let init_monthly = () => {
    // replace the "demo" apikey below with your own key from https://www.alphavantage.co/support/#api-key
    // var url = 'https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=IBM&apikey=demo';
    if (!stock_api_key) { return; }
    if (localStorage.monthly_NVDA_data) { //LOAD FROM LOCAL not API.
        monthly_data = JSON.parse(localStorage.monthly_NVDA_data);
        // let, val_ath=0,val_atl=0,curr_price=0,perc_off_ath=0;
        let data_keys = Object.keys(monthly_data);
        for (let i = 0; i < data_keys.length; i++) {
            daily_data = monthly_data[data_keys[i]];
            if (parseFloat(daily_data["2. high"]) > calculate_ATH) {
                calculate_ATH = parseFloat(daily_data["2. high"])
            }
            if (parseFloat(daily_data["3. low"]) < calculate_ATL || calculate_ATL === 0) {
                calculate_ATL = parseFloat(daily_data["3. low"])
            }
        }
        console.log('ATH:', calculate_ATH)
        console.log('ATL:', calculate_ATL)
        console.log('Curr Price:', current_PRICE)
        console.log('%off ATH', perc_off_ath)
        return;
    }
    // const apiKey = '';
    // const symbol = 'NVDA';
    const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${target_SYMBOL}&apikey=${stock_api_key}`;
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            localStorage.monthly_NVDA_data = JSON.stringify(data["Monthly Adjusted Time Series"]);

        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}; //init_monthly();

const getCrypto_Quotes = async (queries) => {
    let url = `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD&interval=5min&apikey=${stock_api_key}`;
    // fetch(queries[i].url).then((data)=>{
    fetch(url).then((data) => {
        if (data.ok) {
            return data.json();
        } else { debugger; }
    }).then((tickResp) => {
        let tickDaily = tickResp["Time Series (Digital Currency Daily)"]
        let chartFormat = formatCryptoDaily_to_ChartJS(tickDaily);
        save_NEW_CRYPTO_DAILY(chartFormat); //skip duplicates

    }).catch((error) => {
        debugger;
        // showErrorMSG('🛠️ bad request')
        console.log(error)
    })
}
const getData_Quotes = async (queries) => {
    //    if(!stock_api_key){ showErrorMSG('🛠️ connect api'); return;}
    if (!queries.length) { return; }
    try {
        for (let i = 0; i < queries.length; i++) {
            console.log('Query:', queries[i].tkr)
            //CRYPTO QUERIES-----------------------------------
            if (queries[i].tkr === 'BTC'
                || queries[i].tkr === 'ETH'
                || queries[i].tkr === 'LTC'
                || queries[i].tkr === 'AVAX') {
                console.log('Crypto Query:', queries[i].tkr)
                //getCryptoPriceQuery(); //TODO
                continue;
            }
            //END CRYPTO QUERIES-----------------------------------
            fetch(queries[i].url).then((data) => {
                if (data.ok) {
                    return data.json();
                } else { debugger; }
            }).then((tickData) => {
                debugger;
                let xmpl = tickData["Weekly Adjusted Time Series"]["2024-06-18"]
                // if(tickData.Information && tickData.Information.indexOf('Thank you')===0){
                //    showErrorMSG('🛠️ api daily limit');
                //    debugger;
                //    return;
                // }
                // if(!tickData || !tickData["Meta Data"] || !tickData["Meta Data"]["2. Symbol"] ){
                //    debugger; //todo
                // }
                // let responseTick = tickData["Meta Data"]["2. Symbol"];
                // if(!responseTick){return;}
                // let latestClose = tickData["Time Series (5min)"][Object.keys(tickData["Time Series (5min)"])[0]]["4. close"];
                // if(!latestClose){return;}
                // console.log(responseTick,"last close",latestClose)
                // updateLatestTickPrice(responseTick,latestClose);
                //SHOW CONNNECTED and CAP, hide disconnected and key input
                // stateConnectedBox.style.display = "inline";
                // stateNotConnectedBox.style.display = "none";   
                // keyBOX.style.display = "none"; 
                // latestBtn1.style.display = "none"; //do not call twice. because of limit
                // localStorage.ai_ledger = JSON.stringify(ai_ledger) //SAVE to LOCAL STORAGE
                // initEncode(); //RELOAD VIEW. 

            }).catch((error) => {
                debugger;
                // showErrorMSG('🛠️ bad request')
                console.log(error)
            })
        }
    } catch (error) {
        //  showErrorMSG('🛠️ api down')
    }
}


const getLastPriceClick = () => { //loop all for last close.
    let item = {}, queries = [];//urls=[];
    //    for(let i=0;i<ai_ledger.ticks.length;i++){
    // if(i>=1){continue;}//DEV_limiter stay below 20
    //   item = ai_ledger.ticks[i];
    debugger;
    item.tick = 'NVDA';//DEV_specifier 
    item.url = `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=${item.tick}&apikey=${stock_api_key}`;
    // urls.push(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${item.tick}&interval=5min&apikey=${stock_api_key}`)
    //   queries.push({tkr:item.tick,url:`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${item.tick}&interval=5min&apikey=${stock_api_key}`})
    queries.push({ tkr: item.tick, url: item.url })
    //    }
    // if(stock_api_key && urls.length){
    if (stock_api_key && queries.length) {
        getData_Quotes(queries)
        //   showErrorMSG('🌼DATA UPDATED🌼') //todo error. need show message not error.
    } else {
        //   showErrorMSG('🛠️ connect api key'); 
    }
}; //getLastPriceClick();