// Global level object variable
brcLocalAtlas = {}

define(
  ["atlas-general", "atlas-components", "jquery.min", "d3", "brcatlas.umd.min", "brccharts.umd.min"],
  // [foo bar] /*optional dependencies*/, 
  // module definition function
  // dependencies (foo and bar) are mapped to function parameters
  //function ( foo, bar ) {
  function (general, components, jq, d3_7, brcatlas, brccharts) {
    // return a value that defines the module export
    // (i.e the functionality we want to expose for consumption)
    // Create module

    let d3 // Must be made a global variable for brcatlas to work
    let config, mapStatic, mapSlippy, chartByYear, chartByWeek

    components.create()
    general.loadCss('css/brcatlas.umd.css')
    general.loadCss('css/brccharts.umd.css')
    general.loadCss('css/leaflet.css')
    d3=d3_7 // Make module level variable to work

    loadContent(general, brcatlas, brccharts)

    $(window).resize(function() {
      resizeSlippyMap()
    })

    brcLocalAtlas.atlasTaxonSelected = async function () {
      const taxonId = $('#atlas-taxa-select').find(":selected").val()
      console.log('selected', taxonId)

      // Get config
      config = await general.getConfig("../user/config/site.txt")

      // There's always a static map
      mapStatic.setIdentfier(`../user/data/hectad/${taxonId}.csv`)
      mapStatic.redrawMap()
    
      if (config.tabs) {
        if (config.tabs.find(t => t.tab === 'zoom')) {
          mapSlippy.setIdentfier(`../user/data/hectad/${taxonId}.csv`)
          mapSlippy.redrawMap()
        }
        if (config.tabs.find(t => t.tab === 'details')) {
          const url = `../user/data/captions/${taxonId}.md`
          general.file2Html(url).then(res => $(`#brc-tab-details.tab-pane`).html(res) )
        }
        if (config.tabs.find(t => t.tab === 'charts')) {
          console.log('Call update chart')
          d3.csv(`../user/data/weekly/${taxonId}.csv`, d => {
            return {
              taxon: d.taxon,
              count: Number(d.count),
              period: Number(d.period)
            }
          }).then(data => {
            chartByWeek.setChartOpts({data: data})
          })
          d3.csv(`../user/data/yearly/${taxonId}.csv`, d => {
            return {
              taxon: d.taxon,
              count: Number(d.count),
              period: Number(d.period)
            }
          }).then(data => {
            chartByYear.setChartOpts({data: data})
          })
        }
      }
    }

    async function loadContent(general, brcatlas, brccharts) {

      // Open site config file if it exists
      config = await general.getConfig("../user/config/site.txt") 
   
      // Set site name
      if (config.name) {
        $("#atlas-site-name").text(`${config.name}` )
      } else {
        $("#atlas-site-name").text(`No site name specified` )
      }

      // Populate taxon drop-down
      d3.csv(`../user/data/taxa.csv`).then(data => {
        data.forEach(d => {
          const $opt = $('<option>').appendTo($('#atlas-taxa-select'))
          $opt.text(d.taxon)
          $opt.attr('value', d.taxonId)
        })
      })
  
      // Create tabs
      if (config.tabs && config.tabs.length) {
        createTabs(config.tabs)
        populateTabs(config.tabs, brcatlas, brccharts)
      } else { 
        // Default is to just show overview map
        createOverviewMap(brcatlas, "#brc-tabs", "#brc-controls")
      }
    }
    
    function createTabs(tabs) {
      $ul = $('<ul class="nav nav-tabs">').appendTo($('#brc-tabs'))
      $div = $('<div class="tab-content">').appendTo($('#brc-tabs'))
    
      tabs.forEach((t,i) => {
        // Tab
        $li = $('<li class="nav-item">').appendTo($ul)
        $a = $(`<a class="nav-link" data-bs-toggle="tab" href="#brc-tab-${t.tab}" data-tab="${t.tab}">`).appendTo($li)
        $a.on('shown.bs.tab', function (event) {
          // Show/hide associated control panel
          const tabNew = $(event.target).attr('data-tab') // newly activated tab
          const tabPrev = $(event.relatedTarget).attr('data-tab') // previous active tab
          $(`#brc-control-${tabPrev}`).hide()
          $(`#brc-control-${tabNew}`).show()

          resizeSlippyMap()
        })
        $a.text(t.caption ? t.caption : t.tab)

        // Tab pane
        $divt = $(`<div class="tab-pane container fade" id="brc-tab-${t.tab}">`).appendTo($div)
        $divt.css("padding", "0.5em")

        // Control pane
        $divc = $(`<div id="brc-control-${t.tab}">`).appendTo("#brc-controls")
        $divc.css('margin-top', '1em')
        $divc.text(`${t.caption ? t.caption : t.tab} controls`)
        $divc.css('display', 'none')

        // Active
        if (i === 0) {
          $a.addClass("active")
          $divt.removeClass("fade")
          $divt.addClass("active")
          $divc.css('display', '')
        }
      })
    }
    
    function populateTabs(tabs, brcatlas, brccharts) {

      tabs.forEach((t,i) => {
        if (t.tab === "overview") {
          createOverviewMap(brcatlas, "#brc-tab-overview", "#brc-control-overview")
        } else if (t.tab === "zoom") {
          createSlippyMap(brcatlas, "#brc-tab-zoom", "#brc-control-zoom")
        } else if (t.tab === "details") {
          // No action needed here
        } else if (t.tab === "charts") {
          // No action needed here
          createCharts(brccharts, "#brc-tab-charts", "#brc-control-charts")
        } else {
          $(`#brc-tab-${t.tab}.tab-pane`).text(`${t.caption ? t.caption : t.tab} content`)
        }
      })
    }
    
    function createCharts(brccharts, selectorTab, selectorControl) {
      //$(selectorTab).text('Create the temporal charts')

      const width =  450
      const height = 150

      const optsByDay = {
        selector: selectorTab,
        title: 'Records by week',
        titleFontSize: 16,
        data: [],
        taxa: ['taxon'],
        metrics: [
          { prop: 'count', label: 'count', colour: 'rgb(0,128,0)', fill: 'rgb(221,255,221)'},
        ],
        showLegend: false,
        showTaxonLabel: false,
        interactivity: 'mousemove',
        width: width,
        height: height,
        perRow: 1,
        expand: true,
        //missingValues: 'break', 
        metricExpression: '',
        minMaxY: null,
        minY: 0,
        lineInterpolator: 'curveMonotoneX',
        chartStyle: 'area',
        // composition: 'spread',
        periodType: 'week',
        axisLeftLabel: 'Record count',
        margin: {left: 40, right: 0, top: 0, bottom: 15},
      }
      chartByWeek = brccharts.temporal(optsByDay)

      const optsByYear = {
        selector: selectorTab,
        title: 'Records by year',
        titleFontSize: 16,
        data: [],
        taxa: ['taxon'],
        metrics: [
          { prop: 'count', colour: 'grey'},
        ],
        minPeriod: 1980,
        maxPeriod: 2020,
        showLegend: false,
        showTaxonLabel: false,
        interactivity: 'mousemove',
        width: width,
        height: height,
        perRow: 1,
        expand: true,
        missingValues: 'bridge', 
        metricExpression: '',
        minMaxY: null,
        minY: 0,
        periodType: 'year',
        lineInterpolator: 'curveMonotoneX',
        chartStyle: 'bar',
        axisLeftLabel: 'Record count',
        margin: {left: 40, right: 0, top: 0, bottom: 15},
      }
      chartByYear = brccharts.temporal(optsByYear)
    }

    function createOverviewMap(brcatlas, selectorTab, selectorControl) {
      // Initialise map
      const height = config.overview && config.overview.height ? config.overview.height : 500
      // Get value for map width given original height set in config
      // Need to do this with an instance of static map with expand set to false
      // Later used to set the max width of actual map.
      const $divTemp = $('<div id="brc-atlas-local-temp">').appendTo($('body'))
      const mapTemp = brcatlas.svgMap({
        selector: '#brc-atlas-local-temp',
        height: height,
        expand: false,
        transOptsKey: 'BI4',
        mapTypesControl: false,
        transOptsControl: false,
      })
      const maxWidth = mapTemp.getMapWidth()
      $divTemp.remove()
      // Now the real map
      mapStatic = brcatlas.svgMap({
        selector: selectorTab,
        mapTypesKey: 'Standard hectad',
        seaFill: 'white',
        expand: true,
        height: height,
        transOptsKey: 'BI4',
        mapTypesControl: false,
        transOptsControl: false,
        mapTypesSel: {hectad: genHecatdMap},
        mapTypesKey: 'hectad'
      })

      $(selectorTab).css('max-width', `${maxWidth}px`)

      //const width = mapStatic.getMapWidth()
      // $(selectorControl).text('') // Clear
      // createSlider (selectorControl, "Map size:", "80px", function(v) {
      //   $(selectorTab).css('max-width', `${width*v/100}px`)
      // })
    }

    function createSlippyMap(brcatlas, selectorTab, selectorControl) {

      // Initialise map
      mapSlippy = brcatlas.leafletMap({
        selector: selectorTab,
        height: 500,
        mapTypesKey: 'Standard hectad',
        mapTypesSel: {hectad: genHecatdMap},
        mapTypesKey: 'hectad'
      })

      // $(selectorControl).text('') // Clear
      // createSlider (selectorControl, "Map size:", "80px", function(v) {
      //   mapSlippy.setSize($("#brc-tab-zoom").width(), v*5)
      //   mapSlippy.invalidateSize()
      // })
    }

    function resizeSlippyMap() {
      if (mapSlippy) {
        const height = config.zoom && config.zoom.height ? config.zoom.height : 500
        mapSlippy.setSize($("#brc-tab-zoom").width(), height)
        mapSlippy.invalidateSize()
      }
    }

    function createSlider (selector, label, labelWidth, callback ) {
      const $divOuter = $(`<div style="display: grid; grid-template-columns: ${labelWidth} auto; grid-gap: 0px">`).appendTo($(selector))
      $divLabel = $('<div class="grid-child green">').appendTo($divOuter)
      $divLabel.text(label)
      const $divSlider = $('<div class="grid-child glue">').appendTo($divOuter)
      const $slider = $('<input type="range" class="form-range" min="40" value="100">').appendTo($divSlider)
      $slider.on("change", () => callback($slider.val()))
    }
    
    async function genHecatdMap(file) {
    
      const data = await d3.csv(file)
    
      const dataMap = data.map(d => {
        return {gr: d.gr, colour: 'black'}
      })
    
      //console.log('dataMap', dataMap)
    
      return new Promise((resolve) => {
        resolve({
          records: dataMap,
          precision: 10000,
          shape: 'circle',
          opacity: 1,
          size: 1
        })
      })
    }
  }
)




