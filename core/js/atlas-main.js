// Global level object variable
brcLocalAtlas = {}

define(
  ["atlas-general", "atlas-components", "atlas-gallery", "atlas-charts", "atlas-overview", "atlas-zoom", "jquery.min", "d3", "brcatlas.umd.min"],

  function (general, components, galllery, charts, overview, zoom, jq, d3, brcatlas) {

    general.loadCss('css/brcatlas.umd.css')
    general.loadCss('css/brccharts.umd.css')
    general.loadCss('css/leaflet.css')
    general.loadCss('css/lightgallery-bundle.min.css')
    general.loadCss('css/atlas-css.css')

    let config, images
    components.create()

    loadContent()

    brcLocalAtlas.atlasTaxonSelected = async function () {
      const taxonId = $('#atlas-taxa-select').find(":selected").val()
      localStorage.setItem('taxonId', taxonId)

      // There's always a static map
      overview.refreshOverviewMap(taxonId, config)
    
      if (config.tabs) {
        if (config.tabs.find(t => t.tab === 'zoom')) {
          zoom.refreshZoomMap(taxonId)
        }
        if (config.tabs.find(t => t.tab === 'details')) {
          const url = `../user/data/captions/${taxonId}.md`
          general.file2Html(url).then(res => $(`#brc-tab-details.tab-pane`).html(res) )
        }
        if (config.tabs.find(t => t.tab === 'charts')) {
          charts.refreshCharts(taxonId)
        }
        if (config.tabs.find(t => t.tab === 'gallery')) {
          galllery.refreshGallery(taxonId, images)
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
      const prevTaxonId = localStorage.getItem('taxonId')
      d3.csv(`../user/data/taxa.csv`).then(data => {
        data.forEach(d => {
          const $opt = $('<option>').appendTo($('#atlas-taxa-select'))
          $opt.text(d.taxon)
          $opt.attr('value', d.taxonId)

          if (prevTaxonId === d.taxonId) {
            $opt.attr('selected', 'selected')
          }
        })
        if (prevTaxonId) {
          brcLocalAtlas.atlasTaxonSelected()
        }
      })
  
      // Overview map is always displayed but not on a tab if no tabs specified
      // If tabs are specified, but overview map is not included, then add it to tabs.
      if (config.tabs && config.tabs.length && !config.tabs.find(t => t.tab === 'overview')) {
        config.tabs.push({
          tab: 'overview',
          caption: 'Overview'
        })
      }
      // Create tabs
      if (config.tabs && config.tabs.length) {
        createTabs(config.tabs)
        populateTabs(config.tabs)
      } else { 
        // Default is to just show overview map
        overview.createOverviewMap("#brc-tabs", "#brc-controls", config)
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
        
          zoom.resizeZoomMap()
        })
        $a.text(t.caption ? t.caption : t.tab)

        // Tab pane
        $divt = $(`<div class="tab-pane container fade" id="brc-tab-${t.tab}">`).appendTo($div)
        $divt.css("padding", "0.5em")

        // Control pane
        $divc = $(`<div id="brc-control-${t.tab}">`).appendTo("#brc-controls")
        $divc.css('margin-top', '1em')
        $divc.html(`TODO - controls for ${t.caption ? t.caption : t.tab} tab`)
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
          overview.createOverviewMap("#brc-tab-overview", "#brc-control-overview", config)
        } else if (t.tab === "zoom") {
          zoom.createZoomMap("#brc-tab-zoom", "#brc-control-zoom", config)
        } else if (t.tab === "details") {
          // No action needed here
        } else if (t.tab === "charts") {
          charts.createCharts("#brc-tab-charts", "#brc-control-charts", config)
        } else if (t.tab === "gallery") {
          galllery.createGallery("#brc-tab-gallery", "#brc-control-gallery", images)
        } else {
          $(`#brc-tab-${t.tab}.tab-pane`).text(`${t.caption ? t.caption : t.tab} content`)
        }
      })
    }
  }
)