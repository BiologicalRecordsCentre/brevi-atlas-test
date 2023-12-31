// Global level object variable
brcLocalAtlas = {}

define(
  ["atlas-general", "atlas-components", "jquery.min", "d3", 
    "brcatlas.umd.min", "brccharts.umd.min", 
    "lightgallery.umd", "lg-zoom.umd", "lg-thumbnail.umd"],
  // [foo bar] /*optional dependencies*/, 
  // module definition function
  // dependencies (foo and bar) are mapped to function parameters
  //function ( foo, bar ) {
  function (general, components, jq, d3, brcatlas, brccharts, lightGallery, lgZoom, lgThumbnail) {
    // return a value that defines the module export
    // (i.e the functionality we want to expose for consumption)
    // Create module

    general.loadCss('css/brcatlas.umd.css')
    general.loadCss('css/brccharts.umd.css')
    general.loadCss('css/leaflet.css')
    general.loadCss('css/lightgallery-bundle.min.css')

    let config, images, mapStatic, mapSlippy, chartByYear, chartByWeek, inlineGallery
    components.create()

    loadContent()

    $(window).resize(function() {
      resizeSlippyMap()
    })

    brcLocalAtlas.atlasTaxonSelected = async function () {
      const taxonId = $('#atlas-taxa-select').find(":selected").val()
      general.setCookie('taxonId', taxonId, 365)
      brcLocalAtlas.taxonId = taxonId

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
        if (config.tabs.find(t => t.tab === 'gallery')) {
          refreshGallery(taxonId)
        }
      }
    }

    async function loadContent() {

      // Open site config files
      config = await general.getConfig("../user/config/site.txt") 
      images = await general.getConfig("../user/config/images.txt") 

      // Set site name
      if (config.name) {
        $("#atlas-site-name").text(`${config.name}` )
      } else {
        $("#atlas-site-name").text(`No site name specified` )
      }

      // Populate taxon drop-down
      const prevTaxonId = general.getCookie('taxonId')
      d3.csv(`../user/data/taxa.csv`).then(data => {
        data.forEach(d => {
          const $opt = $('<option>').appendTo($('#atlas-taxa-select'))
          $opt.text(d.taxon)
          $opt.attr('value', d.taxonId)

          general.getCookie('taxonId')

          if (prevTaxonId === d.taxonId) {
            $opt.attr('selected', 'selected')
          }
        })
        if (prevTaxonId) {
          brcLocalAtlas.atlasTaxonSelected()
        }
      })
  
      // Create tabs
      if (config.tabs && config.tabs.length) {
        createTabs(config.tabs)
        populateTabs(config.tabs)
      } else { 
        // Default is to just show overview map
        createOverviewMap("#brc-tabs", "#brc-controls")
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
    
    function populateTabs(tabs) {

      tabs.forEach((t,i) => {
        if (t.tab === "overview") {
          createOverviewMap("#brc-tab-overview", "#brc-control-overview")
        } else if (t.tab === "zoom") {
          createSlippyMap("#brc-tab-zoom", "#brc-control-zoom")
        } else if (t.tab === "details") {
          // No action needed here
        } else if (t.tab === "charts") {
          createCharts("#brc-tab-charts", "#brc-control-charts")
        } else if (t.tab === "gallery") {
          createGallery()
        } else {
          $(`#brc-tab-${t.tab}.tab-pane`).text(`${t.caption ? t.caption : t.tab} content`)
        }
      })
    }
    
    function createCharts(selectorTab, selectorControl) {
      //$(selectorTab).text('Create the temporal charts')

      const width =  450
      const height = config.charts && config.charts.height ? config.charts.height / 2 : 150

      $('<div>Records by week</div>').appendTo($(selectorTab))
      $(selectorTab)
      const optsByDay = {
        selector: selectorTab,
        // title: 'Records by week',
        // titleFontSize: 14,
        data: [],
        taxa: ['taxon'],
        metrics: [
          { prop: 'count', label: 'count', colour: 'rgb(0,128,0)', fill: 'rgb(221,255,221)'},
        ],
        showLegend: false,
        showTaxonLabel: false,
        interactivity: 'none',
        width: width,
        height: height,
        perRow: 1,
        expand: true,
        missingValues: 0, 
        metricExpression: '',
        minMaxY: null,
        minY: 0,
        lineInterpolator: 'curveMonotoneX',
        chartStyle: 'area',
        periodType: 'week',
        axisLeftLabel: 'Record count',
        margin: {left: 40, right: 0, top: 0, bottom: 15},
      }
      chartByWeek = brccharts.temporal(optsByDay)

      $('<div>Records by year</div>').appendTo($(selectorTab))
      const optsByYear = {
        selector: selectorTab,
        // title: 'Records by year',
        // titleFontSize: 14,
        data: [],
        taxa: ['taxon'],
        metrics: [
          { prop: 'count', colour: 'grey'},
        ],
        minPeriod: 1980,
        maxPeriod: 2020,
        showLegend: false,
        showTaxonLabel: false,
        interactivity: 'none',
        width: width,
        height: height,
        perRow: 1,
        expand: true,
        metricExpression: '',
        minMaxY: null,
        minY: 0,
        periodType: 'year',
        chartStyle: 'bar',
        axisLeftLabel: 'Record count',
        margin: {left: 40, right: 0, top: 0, bottom: 15},
      }
      chartByYear = brccharts.temporal(optsByYear)
    }

    function createOverviewMap(selectorTab, selectorControl) {
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

    function createSlippyMap(selectorTab, selectorControl) {

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

    function createGallery() {

      const selectorTab = "#brc-tab-gallery"
      $(selectorTab).css('height', `${config.gallery && config.gallery.height ? config.gallery.height : 350}px`)
      $(selectorTab).css('height', 0)
      $(selectorTab).css('width', '100%')
      $(selectorTab).css('padding-bottom', '65%')

      const lgContainer = $(selectorTab)[0]

      // After https://www.lightgalleryjs.com/demos/inline/ & https://codepen.io/sachinchoolur/pen/zYZqaGm
      inlineGallery = lightGallery(lgContainer, { // eslint-disable-line no-undef
        container: lgContainer,
        dynamic: true,
        // Turn off hash plugin in case if you are using it
        // as we don't want to change the url on slide change
        hash: false,
        // Do not allow users to close the gallery
        closable: false,
        // Hide download button
        download: false,
        // Add maximize icon to enlarge the gallery
        showMaximizeIcon: true,
        // Append caption inside the slide item
        // to apply some animation for the captions (Optional)
        appendSubHtmlTo: '.lg-item',
        // Delay slide transition to complete captions animations
        // before navigating to different slides (Optional)
        // You can find caption animation demo on the captions demo page
        slideDelay: 400,
        plugins: [lgZoom, lgThumbnail], // eslint-disable-line no-undef
        dynamicEl: [
          {
            src: `../user/data/images/worm1.jpg`,
            thumb: `../user/data/images/worm1.jpg`,
            subHtml: `<div>worm1</div>`
          }
        ],
        thumbWidth: 90,
        thumbHeight: "60px",
        thumbMargin: 4
      })
    }

    function refreshGallery(taxonId){

      let dynamicEl
      if (images[taxonId] && Array.isArray(images[taxonId])) {
        dynamicEl = images[taxonId].map(i => {
          return {
            alt: i.caption,
            src: `../user/data/images/${i.file}`,
            thumb: `../user/data/images/${i.thumb ? i.thumb : i.file}`,
            subHtml: `
              <div class="lightGallery-captions">
                <div style="background-color: black; opacity: 0.7">
                <p style="margin: 0.3em">Caption: ${i.caption}</p>
                <div>
              </div>`
          }
        })
      } else {
        dynamicEl = []
      }

      if (inlineGallery && dynamicEl.length) {
        $('.lg-container').show()
        inlineGallery.openGallery()
        inlineGallery.updateSlides(
          dynamicEl,
          inlineGallery.index
        )
      } else {
        $('.lg-container').hide()
      }
    }
  }
)





