const FieldNotesRuntime = (function () {
  "use strict";

  const INK = "#202E45", GREEN = "#345F91", BLUE = "#AD5941", GOLD = "#775B87";
  const FIRST = 1995, LAST = 2023;
  const MAP_FRAME = { x:5, y:10, width:470, height:221 };
  const MAP_ZOOM = [1, 1.5, 2, 3, 4, 6];
  const PEER_ROW_HEIGHT = 33;
  const PEER_OVERSCAN = 5;
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const defs = {
    inv: ["Fixed investment", "money", GREEN, "Assets acquired during the year, less disposals, before deducting depreciation. Covers agriculture, forestry and fishing.", "M3 16h18M4 16v-5h4v5m3 0V6h4v10m3 0v-8h3v8"],
    dep: ["Depreciation", "money", BLUE, "Estimated annual loss of value as fixed assets wear out or become obsolete.", "M4 6l6 6 4-3 6 7m-5 0h5v-5"],
    net: ["Net fixed investment", "money", GREEN, "Fixed investment minus consumption of fixed capital during the same year. A negative value means investment fell short of estimated depreciation.", "M3 12h18m-14 0v-6m5 6v5m5-5v-8"],
    stock: ["Net capital stock", "money", BLUE, "The estimated value of fixed assets still in use after accumulated depreciation. This is a balance for the selected year.", "M3 7l9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"],
    va: ["Sector value added", "money", GREEN, "The value created by agriculture, forestry and fishing after subtracting intermediate inputs such as fuel, feed and fertilizer.", "M4 19h16M6 16l5-5 4 2 4-6m-4 0h4v4"],
    share: ["Share of GDP", "percent", GOLD, "Agriculture, forestry and fishing value added as a share of GDP, on the published constant-price basis. Change is shown in percentage points.", "M12 3v9h9A9 9 0 1 1 12 3Zm3 0a8 8 0 0 1 6 6h-6V3Z"],
    aoi: ["Investment orientation", "ratio", GOLD, "The sector’s share of fixed investment divided by its share of GDP, as published by FAOSTAT. A value of 1 means the shares are equal.", "M12 3v18m-8-5h16M5 6h14"],
    prod: ["Value added per dollar of stock", "ratio", BLUE, "Annual sector value added divided by net capital stock. This is a descriptive ratio; differences can reflect capital mix, sector composition or other factors.", "M3 17l5-7 4 3 6-9m-1 0h4v4"],
  };
  const pages = {
    overview: ["Executive Overview", "Investment, fixed assets and economic contribution in agriculture, forestry and fishing"],
    investment: ["Investment & Capital", "Compare investment flows, asset depreciation and the remaining capital base"],
    economy: ["Economic Contribution", "Track value added and the sector’s share of GDP"],
    benchmark: ["Country Benchmarking", "Compare published observations across areas in a single year"],
  };
  const types = ["Country", "Region", "Group", "World"];
  const yrs = Array.from({ length: LAST - FIRST + 1 }, (_, i) => i + FIRST);
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const html = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const escNumber = n => Number(n).toFixed(2);
  const icon = path => `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
  const pinIcon = icon("M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z M14 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z");
  const yearIcon = icon("M4 6h16v15H4zM8 3v6m8-6v6M4 11h16");
  function amount(value, kind, compact = true) {
    if (!finite(value)) return "—";
    if (kind === "percent") return `${nf.format(value * 100)}%`;
    if (kind === "ratio") return nf.format(value);
    const abs = Math.abs(value);
    const sign = value < 0 ? "−" : "";
    if (!compact) return `${sign}$${nf.format(abs)}M`;
    if (abs >= 1e6) return `${sign}$${nf.format(abs / 1e6)}T`;
    if (abs >= 1e3) return `${sign}$${nf.format(abs / 1e3)}B`;
    return `${sign}$${nf.format(abs)}M`;
  }
  function changeText(value, kind) {
    if (!finite(value)) return "—";
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    if (kind === "pp") return sign + nf.format(Math.abs(value) * 100) + " pp";
    if (kind === "percent") return sign + nf.format(Math.abs(value) * 100) + "%";
    return sign + amount(Math.abs(value), kind);
  }
  function pill(value, kind, context = "") {
    const tone = finite(value) && value > 0 ? "up" : finite(value) && value < 0 ? "down" : "neutral";
    const arrow = tone === "up" ? "↗" : tone === "down" ? "↘" : "—";
    return `<span class="delta ${tone}"><span aria-hidden="true">${arrow}</span> ${changeText(value, kind)}</span>${context ? `<span class="delta-context">${html(context)}</span>` : ""}`;
  }
  function flag(row) {
    try {
      const u = new URL(row?.flagUrl);
      if (u.protocol !== "https:" || !["flagcdn.com", "upload.wikimedia.org"].includes(u.hostname)) return "";
      const source = FieldNotesFlags[u.href];
      return source ? `<img class="flag" src="${html(source)}" alt="" loading="lazy">` : "";
    } catch { return ""; }
  }
  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const median = values => {
    const sorted = values.filter(finite).sort((a, b) => a - b);
    return sorted.length ? (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2 : null;
  };
  function pathFor(points, getX, getY) {
    let connected = false;
    return points.map(point => {
      if (!finite(point.value)) { connected = false; return ""; }
      const key = connected ? "L" : "M";
      connected = true;
      return `${key}${escNumber(getX(point))},${escNumber(getY(point))}`;
    }).join(" ");
  }
  function smoothPath(points, getX, getY) {
    const stretches = [];
    let segment = [];
    for (const point of points) {
      if (finite(point.value)) segment.push([getX(point), getY(point)]);
      else if (segment.length) { stretches.push(segment); segment = []; }
    }
    if (segment.length) stretches.push(segment);
    const pair = (x, y) => `${escNumber(x)},${escNumber(y)}`;
    return stretches.map(coords => {
      let d = "M" + pair(...coords[0]);
      if (coords.length === 1) return d;
      const slopes = coords.slice(1).map(([x, y], i) => (y-coords[i][1])/(x-coords[i][0]));
      const tangent = coords.map((_, i) => {
        if (i === 0) return slopes[0];
        if (i === coords.length-1) return slopes.at(-1);
        const a=slopes[i-1], b=slopes[i];
        return a*b <= 0 ? 0 : 2*a*b/(a+b);
      });
      for (let i=1;i<coords.length;i++) {
        const [x,y]=coords[i-1], [nextX,nextY]=coords[i], step=(nextX-x)/3;
        d+=` C${pair(x+step,y+tangent[i-1]*step)} ${pair(nextX-step,nextY-tangent[i]*step)} ${pair(nextX,nextY)}`;
      }
      return d;
    }).join(" ");
  }
  function spark(rows, key) {
    const points = rows.map((row, i) => ({ i, value: row?.[key] }));
    const values = points.map(p => p.value).filter(finite);
    if (values.length < 2) return "";
    const min = Math.min(...values), span = Math.max(...values) - min || Math.max(Math.abs(min) * 0.1, 1);
    const d = pathFor(points, p => 4 + 112 * p.i / (points.length - 1), p => 32 - (p.value - min) * 26 / span);
    return `<svg class="spark" viewBox="0 0 120 38" aria-label="Six-year trend" role="img"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  function helpDialog() {
    return `<div class="help-overlay" hidden><section class="help-panel" role="dialog" aria-modal="true" aria-labelledby="atlas-help-heading">
      <header><div><small>CAPITAL ATLAS</small><h2 id="atlas-help-heading">How to use this report</h2></div><button data-command="help" aria-label="Close help">×</button></header>
      <dl>
        <div><dt>Explore an area</dt><dd>Pick an area and year, or click a country on the map to update the overview. Use + and − to zoom, then drag to move around. Region mode selects published regional totals.</dd></div>
        <div><dt>Read the KPIs</dt><dd>Hover or focus a card for its definition. Click to keep the definition open.</dd></div>
        <div><dt>Compare time ranges</dt><dd>Drag on a trend or set the two years. Compare start to end, or use the preceding window of equal length.</dd></div>
        <div><dt>Benchmark countries</dt><dd>Select a dot to highlight an area, or a shaded quadrant to filter the table. Dashed lines show the peer medians.</dd></div>
      </dl>
      <footer>Amounts are in constant 2015 USD. M, B and T mean million, billion and trillion. pp means percentage points. A dash marks unavailable data.</footer>
      </section></div>`;
  }

  class Report {
    constructor(root, mode, options = {}) {
      this.root = root;
      this.mode = mode;
      this.preview = options.preview || false;
      this.rows = [];
      this.mapView = { step:0, x:0, y:0 };
      this.mapDrag = null;
      this.suppressMapClick = false;
      this.state = { type: "Country", area: "Morocco", year: LAST, lo: 2014, hi: LAST,
        chart: mode === "economy" ? "share" : "inv", comparison: "endpoints",
        rank: "stock", focus: "Morocco", quadrant: "", query: "", flipped: new Set() };
      this.root.className = "fn-root";
      this.root.addEventListener("click", event => this.click(event));
      this.root.addEventListener("change", event => this.change(event));
      this.root.addEventListener("input", event => this.search(event));
      this.root.addEventListener("wheel", event => this.scrollPeers(event), { passive:false });
      this.root.addEventListener("pointerover", event => this.tooltip(event));
      this.root.addEventListener("focusin", event => this.tooltip(event));
      this.root.addEventListener("pointerout", event => this.hideTooltip(event));
      this.root.addEventListener("focusout", event => this.hideTooltip(event));
      this.root.addEventListener("pointerdown", event => {
        if (event.target.closest("[data-map-canvas]")) this.startMapDrag(event);
        else this.startBrush(event);
      });
      this.root.addEventListener("pointermove", event => {
        if (this.mapDrag) this.moveMapDrag(event);
        else this.moveBrush(event);
      });
      this.root.addEventListener("pointerup", event => {
        if (this.mapDrag) this.endMapDrag(event);
        else this.endBrush(event);
      });
      this.root.addEventListener("pointercancel", event => {
        this.endMapDrag(event);
        this.drag = null;
      });
      this.root.addEventListener("keydown", event => this.handleKey(event));
    }
    update(rows, width, height) {
      this.width = width || 1472;
      this.height = height || 900;
      this.rows = rows.filter(r => r.area && finite(r.year));
      this.groups = new Map();
      this.records = new Map();
      this.countryNames = new Map();
      this.areaYearGroups = new Map();
      for (const row of this.rows) {
        const group = this.groups.get(row.type) || new Set();
        group.add(row.area);
        this.groups.set(row.type, group);
        this.records.set(`${row.area}\n${row.year}`, row);
        const key=`${row.type}\n${row.year}`;
        const areas=this.areaYearGroups.get(key) || [];
        areas.push(row);
        this.areaYearGroups.set(key,areas);
        if (row.type === "Country" && row.m49) this.countryNames.set(row.m49,row.area);
      }
      this.render();
    }
    row(area, year) { return this.records.get(`${area}\n${year}`); }
    peers(type,year) { return this.areaYearGroups.get(`${type}\n${year}`) || []; }
    options(values, selected) {
      return values.map(value => `<option value="${html(value)}"${String(value) === String(selected) ? " selected" : ""}>${html(value)}</option>`).join("");
    }
    header() {
      const s = this.state;
      const [title, subtitle] = pages[this.mode];
      const buttons = types.map(type => `<button class="${type === s.type ? "active" : ""}" data-type="${type}" aria-pressed="${type === s.type}" ${this.groups.has(type) ? "" : "disabled"}>${type}</button>`).join("");
      const candidates = [...(this.groups.get(s.type) || [])].sort((a, b) => a.localeCompare(b));
      if (candidates.length && !candidates.includes(s.area)) s.area = candidates.includes("Morocco") ? "Morocco" : candidates[0];
      if (candidates.length && !candidates.includes(s.focus)) s.focus = candidates.includes("Morocco") ? "Morocco" : candidates[0];
      const benchmark = this.mode === "benchmark";
      const person = benchmark ? s.focus : s.area;
      return `<header class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div>
        <div class="period-note"><span>FAOSTAT</span><strong>1995–2023</strong></div></header>
        <div class="filters"><div class="seg types" role="group" aria-label="Area type">${buttons}</div>
        <label class="select-area"><span>${pinIcon}${benchmark ? "Highlight area" : "Area"}</span><select data-select="${benchmark ? "focus" : "area"}">${this.options(candidates, person)}</select></label>
        ${benchmark || this.mode === "overview" ? `<label><span>${yearIcon}Year</span><select data-select="year">${this.options([...yrs].reverse(), s.year)}</select></label>` : ""}
        </div>`;
    }
    rail() {
      const tag=this.preview ? "button" : "div";
      const links=Object.entries(pages).map(([id,page],i)=>
        `<${tag} class="rail-link ${id===this.mode ? "current":""}" ${this.preview?`data-page="${id}"`:""}><span>${String(i+1).padStart(2,"0")}</span>${page[0]}</${tag}>`).join("");
      return `<aside class="rail"><div class="rail-brand"><div><small>AGRIFOOD ECONOMICS</small><strong>Capital Atlas</strong></div></div>
        <nav aria-label="Report pages" ${this.preview?"":'aria-hidden="true"'}>${links}</nav>
        <div class="rail-bottom"><button class="support" data-command="help" aria-expanded="false"><span>?</span> How to use</button>
        <footer><span>Designed by</span><strong>Mostafa Laaoucihir</strong><time datetime="2026-11-21">21 November 2026</time></footer></div></aside>`;
    }
    render() {
      const baseWidth = 1472;
      const scale = Math.min(this.width / baseWidth, this.height / 900);
      this.root.innerHTML = `<div class="fn-stage atlas-stage" style="width:${baseWidth}px;height:900px;transform:scale(${scale})"><div class="atlas-layout">${this.rail()}${this.content()}</div>${helpDialog()}<div class="fn-tooltip" role="tooltip" hidden></div></div>`;
      const table=this.root.querySelector(".table-scroll");
      if (table) {
        this.drawPeerRows(table);
        let queued=false;
        table.addEventListener("scroll",()=>{
          if (queued) return;
          queued=true;
          window.requestAnimationFrame(()=>{
            queued=false;
            if (table.isConnected) this.drawPeerRows(table);
          });
        },{passive:true});
      }
    }
    content() {
      const header = this.header();
      if (!this.rows.length) return `<main>${header}<div class="panel blank">Waiting for Power BI to load observations.</div></main>`;
      const body = this.mode === "overview" ? this.overview()
        : this.mode === "benchmark" ? this.benchmark()
        : this.range();
      return `<main${this.mode==="benchmark"?' class="benchmark-page"':""}>${header}${body}<footer class="source">FAOSTAT Capital Stock and Macro Indicators${this.mode==="overview"?" · Map boundaries by Natural Earth":""} <span>Amounts in constant 2015 USD</span></footer></main>`;
    }
    detail(key, row, year, area = this.state.area) {
      const [label, kind] = defs[key];
      const prior = this.row(area, year - 1)?.[key];
      const value = row?.[key];
      const difference = finite(value) && finite(prior) ? value - prior : null;
      const relative = finite(difference) && prior > 0 ? difference / prior : null;
      return `<b>${html(area)} · ${year}</b><span>${html(label)} <strong>${amount(value, kind)}</strong></span><span>Prior year <strong>${amount(prior, kind)}</strong></span><span>Change <strong>${changeText(difference, kind === "percent" ? "pp" : kind)}</strong></span>${kind === "money" && finite(relative) ? `<span>Year over year <strong>${changeText(relative, "percent")}</strong></span>` : ""}`;
    }
    kpi(key, row, recent) {
      const [label, kind, tone, definition, path] = defs[key];
      const s = this.state;
      const prior = this.row(s.area, s.year - 1)?.[key];
      const val = row?.[key];
      const delta = finite(val) && finite(prior) && (kind === "percent" || prior > 0)
        ? (kind === "percent" ? val - prior : (val - prior) / prior) : null;
      const reverse = key === "inv"
        ? this.investmentStory(row)
        : `<div class="face reverse"><small>METRIC DEFINITION</small><h3>${label}</h3><p>${definition}</p></div>`;
      return `<article class="flip ${key === "inv" ? "hero" : ""} ${s.flipped.has(key) ? "turned" : ""}" data-flip="${key}" tabindex="0" role="button" aria-label="${html(label)}: ${amount(val, kind)}. ${html(definition)}">
        <div class="flip-content"><div class="face front"><div class="kpi-head">${icon(path)}<span>${label}</span></div>
        <strong class="kpi-value">${amount(val, kind)}</strong>
        <div class="kpi-foot"><div>${pill(delta, kind === "percent" ? "pp" : "percent", "vs " + (s.year - 1))}</div>${spark(recent, key)}</div></div>
        ${reverse}</div></article>`;
    }
    investmentStory(row) {
      const {area,year}=this.state;
      const investment=row?.inv;
      const net=finite(investment)&&finite(row?.dep)?investment-row.dep:null;
      const current=finite(investment)
        ? `<strong>${html(area)} recorded ${amount(investment,"money")}</strong> in fixed investment in ${year}.`
        : `Fixed investment is unavailable for ${html(area)} in ${year}.`;
      const context=finite(net)
        ? net===0
          ? "It matched estimated depreciation for the year."
          : `That was <strong>${amount(Math.abs(net),"money")} ${net>0?"above":"below"}</strong> estimated depreciation, the value lost as assets wear out.`
        : "Fixed investment tracks acquisitions less disposals of long-lived assets such as machinery and irrigation systems.";
      return `<div class="face reverse hero-story">
        <div class="story-badge">${icon("M9 17h6m-5 3h4M9 14a5 5 0 1 1 6 0c-.7.6-1 1.2-1 2h-4c0-.8-.3-1.4-1-2Z")}<span>WHY THIS MATTERS</span></div>
        <p>${current} ${context}</p><span class="story-accent" aria-hidden="true"></span></div>`;
    }
    overview() {
      const s = this.state;
      const row = this.row(s.area, s.year);
      const recent = Array.from({length: 6}, (_, i) => this.row(s.area, s.year - 5 + i));
      const trend = this.trendSvg(["inv","dep"], { showRange: false, until: s.year, height: 328, smooth:true });
      return `<div class="overview-kpis">${["inv","stock","va","share"].map(key => this.kpi(key, row, recent)).join("")}</div>
        <div class="overview-grid"><section class="panel overview-chart"><div class="panel-head"><div><h2>Investment vs. depreciation</h2><p>Annual sector flows through ${s.year}</p></div></div>${this.legend(["inv","dep"])}${trend}</section>${this.atlas(row)}</div>`;
    }
    atlas(row) {
      const s=this.state, regional=s.type==="Region";
      const candidates=this.groups.get("Region")||new Set();
      const invest=this.peers("Country",s.year).filter(r=>finite(r.inv)&&r.inv>=0).map(r=>r.inv);
      const top=Math.max(1,...invest);
      const hues=["#d0d9e8","#a2b7d1","#6d8eb2","#416890","#214a75"];
      const shapes=CapitalAtlasMap.map(([code,region,name,outline,x,y])=>{
        const country=this.countryNames.get(code);
        const filter=regional?(candidates.has(region)?region:null):country;
        const selectionType=regional?"Region":"Country";
        const selected=filter===s.area&&selectionType===s.type;
        const observation=this.row(country,s.year);
        const have=finite(observation?.inv);
        const idx=have?Math.floor(Math.max(0,Math.min(.999,Math.log1p(Math.max(0,observation.inv))/Math.log1p(top)))*5):0;
        const fill=selected?"#d58162":have?hues[idx]:"#e3e7ee";
        const attrs=filter?`data-map="${html(filter)}" data-map-type="${selectionType}" data-tip="${html(`<b>${html(filter)} · ${s.year}</b><span>Fixed investment <strong>${amount(this.row(filter,s.year)?.inv,"money")}</strong></span><span>Select to update overview</span>`)}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="Select ${html(filter)}"`:`aria-label="${html(name)}"`;
        const cls=`territory${selected?" selected":""}`;
        return {selected,markup:outline?`<path class="${cls}" d="${outline}" fill="${fill}" ${attrs}/>`:
          filter?`<circle class="${cls} small-area" cx="${x}" cy="${y}" r="2.6" fill="${fill}" ${attrs}/>`:""};
      }).sort((a,b)=>Number(a.selected)-Number(b.selected)).map(entry=>entry.markup).join("");
      const m=this.mapView;
      return `<section class="panel atlas-panel"><div class="atlas-head"><div><h2>Investment Atlas</h2><p>${regional?"Select a region to explore its published totals.":"Select a country to update the overview."}</p></div>
        <div class="map-controls" role="group" aria-label="Map zoom">
          <button data-map-zoom="out" aria-label="Zoom out" title="Zoom out" ${m.step===0?"disabled":""}>−</button>
          <span class="map-scale" aria-live="polite">${MAP_ZOOM[m.step]}×</span>
          <button data-map-zoom="in" aria-label="Zoom in" title="Zoom in" ${m.step===MAP_ZOOM.length-1?"disabled":""}>+</button>
          <button class="map-reset" data-map-zoom="reset" aria-label="Reset map view" title="Reset map view" ${m.step===0?"disabled":""}>${icon("M7 7a7 7 0 1 1-1.6 8M7 7V3m0 4H3")}</button>
        </div></div>
        <div class="atlas-map"><svg data-map-canvas class="${m.step?"zoomed":""}" tabindex="0" viewBox="${MAP_FRAME.x} ${MAP_FRAME.y} ${MAP_FRAME.width} ${MAP_FRAME.height}" aria-label="Interactive world map of fixed investment. Plus and minus zoom, arrow keys pan, and zero resets." role="group"><g data-map-world transform="${this.mapTransform()}">${shapes}</g></svg></div>
        <div class="map-legend"><span>Fixed investment · lower</span>${hues.map(h=>`<i style="background:${h}"></i>`).join("")}<span>higher</span></div>
        <div class="atlas-selected"><div>${flag(row)}<strong>${html(s.area)}</strong><small>${html(s.type)}</small></div><strong>${amount(row?.inv,"money")}</strong></div>
        </section>`;
    }
    mapTransform() {
      const { x,y,step }=this.mapView;
      return `translate(${x} ${y}) scale(${MAP_ZOOM[step]})`;
    }
    updateMap() {
      const m=this.mapView, svg=this.root.querySelector("[data-map-canvas]");
      if (!svg) return;
      svg.querySelector("[data-map-world]").setAttribute("transform",this.mapTransform());
      svg.classList.toggle("zoomed",m.step>0);
      const scale=this.root.querySelector(".map-scale"), label=`${MAP_ZOOM[m.step]}×`;
      if (scale.textContent!==label) scale.textContent=label;
      this.root.querySelector('[data-map-zoom="out"]').disabled=m.step===0;
      this.root.querySelector('[data-map-zoom="reset"]').disabled=m.step===0;
      this.root.querySelector('[data-map-zoom="in"]').disabled=m.step===MAP_ZOOM.length-1;
    }
    moveMapTo(x,y) {
      const m=this.mapView, f=MAP_FRAME, scale=MAP_ZOOM[m.step];
      m.x=Math.max((f.x+f.width)*(1-scale),Math.min(f.x*(1-scale),x));
      m.y=Math.max((f.y+f.height)*(1-scale),Math.min(f.y*(1-scale),y));
      this.updateMap();
    }
    zoomMap(action) {
      const m=this.mapView, f=MAP_FRAME;
      const previous=m.step;
      const step=action==="reset"?0:Math.max(0,Math.min(MAP_ZOOM.length-1,previous+(action==="in"?1:-1)));
      if (step===previous) return;
      m.step=step;
      if (step===0) { this.moveMapTo(0,0); return; }
      const ratio=MAP_ZOOM[step]/MAP_ZOOM[previous];
      const centerX=f.x+f.width/2, centerY=f.y+f.height/2;
      const selected=previous===0 && this.state.type==="Country"
        ? CapitalAtlasMap.find(([code])=>code&&this.countryNames.get(code)===this.state.area) : null;
      this.moveMapTo(selected?centerX-ratio*selected[4]:centerX-(centerX-m.x)*ratio,
        selected?centerY-ratio*selected[5]:centerY-(centerY-m.y)*ratio);
      this.root.querySelector(".fn-tooltip").hidden=true;
    }
    startMapDrag(event) {
      const svg=event.target.closest("[data-map-canvas]");
      this.suppressMapClick=false;
      if (event.button!==0 || this.mapView.step===0) return;
      const matrix=svg.getScreenCTM();
      if (!matrix) return;
      const inverse=matrix.inverse();
      this.mapDrag={svg,inverse,id:event.pointerId,
        start:new DOMPoint(event.clientX,event.clientY).matrixTransform(inverse),
        fromX:this.mapView.x,fromY:this.mapView.y,screenX:event.clientX,screenY:event.clientY,moved:false};
    }
    moveMapDrag(event) {
      const pan=this.mapDrag;
      if (pan.id!==event.pointerId) return;
      if (!pan.moved) {
        if (Math.hypot(event.clientX-pan.screenX,event.clientY-pan.screenY)<5) return;
        pan.moved=true;
        pan.svg.setPointerCapture(event.pointerId);
        pan.svg.classList.add("panning");
        this.root.querySelector(".fn-tooltip").hidden=true;
      }
      const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(pan.inverse);
      this.moveMapTo(pan.fromX+point.x-pan.start.x,pan.fromY+point.y-pan.start.y);
    }
    endMapDrag(event) {
      const pan=this.mapDrag;
      if (!pan || pan.id!==event.pointerId) return;
      this.suppressMapClick=pan.moved;
      pan.svg.classList.remove("panning");
      this.mapDrag=null;
    }
    legend(keys) {
      return `<div class="legend">${keys.map(key => `<span><i style="background:${defs[key][2]}"></i>${defs[key][0]}</span>`).join("")}</div>`;
    }
    rangeSummary() {
      const s = this.state, [label, kind] = defs[s.chart];
      const rangeLength = s.hi - s.lo + 1;
      const priorLow = s.lo - rangeLength, priorHigh = s.lo - 1;
      const getValues = (a, b) => yrs.filter(year => year >= a && year <= b).map(y => this.row(s.area,y)?.[s.chart]).filter(finite);
      const active = getValues(s.lo, s.hi), prior = getValues(priorLow, priorHigh);
      const isWindow = s.comparison === "window";
      const fromValue = isWindow ? mean(prior) : this.row(s.area,s.lo)?.[s.chart];
      const toValue = isWindow ? mean(active) : this.row(s.area,s.hi)?.[s.chart];
      const aligned = !isWindow || (active.length === rangeLength && prior.length === rangeLength);
      const delta = aligned && finite(fromValue) && finite(toValue) ? toValue - fromValue : null;
      const percent = kind === "money" && finite(delta) && fromValue > 0 ? delta / fromValue : null;
      const priorLabel = isWindow ? `Prior window · ${priorLow}–${priorHigh}` : `Start · ${s.lo}`;
      const activeLabel = isWindow ? `Focus window · ${s.lo}–${s.hi}` : `End · ${s.hi}`;
      const explanation = isWindow ? (aligned ? "Average annual observations in equally long windows."
        : "Variance needs a value for every year in both windows.") : "Change from the start year to the end year.";
      return `<div class="range-summary"><div><span>${priorLabel}</span><strong>${amount(fromValue,kind)}</strong>${isWindow ? `<small>${prior.length}/${rangeLength} years available</small>` : ""}</div>
        <div><span>${activeLabel}</span><strong>${amount(toValue,kind)}</strong>${isWindow ? `<small>${active.length}/${rangeLength} years available</small>` : ""}</div>
        <div><span>Change in ${label.toLowerCase()}</span><strong>${pill(delta, kind === "percent" ? "pp" : kind)}${finite(percent) ? pill(percent,"percent") : ""}</strong><small>${explanation}</small></div></div>`;
    }
    seg(values, key) {
      return `<div class="seg" role="group" aria-label="${html(key)}">${values.map(([value, label]) =>
        `<button class="${this.state[key] === value ? "active" : ""}" data-state="${key}" data-value="${html(value)}" aria-pressed="${this.state[key] === value}">${html(label)}</button>`).join("")}</div>`;
    }
    range() {
      const s = this.state;
      const econ = this.mode === "economy";
      const choices = econ ? [["share","GDP share"],["va","Value added"]]
        : [["inv","Investment & depreciation"],["net","Net investment"],["stock","Net capital stock"]];
      const keys = s.chart === "inv" ? ["inv","dep"] : [s.chart];
      return `<section class="panel range-panel"><div class="panel-head"><div><h2>${html(s.area)} · Annual trend</h2><p>Drag across the chart to set the focus range.</p></div>${this.seg(choices, "chart")}</div>
        <div class="range-controls">${this.seg([["endpoints","Start to end"],["window","Prior window"]], "comparison")}
        <div class="date-fields"><label>Start<select data-select="lo">${this.options(yrs.filter(y=>y<=s.hi),s.lo)}</select></label><label>End<select data-select="hi">${this.options(yrs.filter(y=>y>=s.lo),s.hi)}</select></label>
        <button data-preset="5">Last 5 years</button><button data-preset="10">Last 10 years</button><button data-preset="all">Full range</button></div></div>
        ${this.rangeSummary()}<div class="plot-legend">${this.legend(keys)}<span><i class="focus-key"></i> Focus${s.comparison === "window" ? ' <i class="prior-key"></i> Prior window' : ""}</span></div>
        ${this.trendSvg(keys,{showRange:true,height:339,bars:s.chart==="net"})}</section>
        <div class="analysis-foot"><strong>${html(defs[s.chart][0])}</strong><span>${html(defs[s.chart][3])}</span></div>`;
    }
    trendSvg(keys, options) {
      const s = this.state, availableYears = yrs.filter(y => y <= (options.until || LAST));
      const rows = availableYears.map(year => this.row(s.area, year));
      const numbers = rows.flatMap(row => keys.map(k => row?.[k])).filter(finite);
      if (!numbers.length) return `<div class="blank no-chart">No observations for this area and metric.</div>`;
      const wide = options.showRange ? 1136 : 683;
      const h = options.height, left = 73, right = wide - 20, top = 20, bottom = h - 37;
      const kind = defs[keys[0]][1], m = Math.min(...numbers), max = Math.max(...numbers);
      const low = options.bars ? Math.min(0,m) : kind === "percent" ? Math.max(0,m - (max-m || .01)*.14) : Math.min(0,m);
      const high = max === low ? low + (kind === "percent" ? 0.05 : 1) : Math.max(options.bars ? 0 : -Infinity,max) + (max-low) * .13;
      const x = year => left + (right-left) * (year-FIRST) / Math.max(1,availableYears.at(-1)-FIRST);
      const y = value => bottom - (bottom-top) * (value-low) / (high-low);
      const rangeBox = (from,to, cls) => {
        const start = Math.max(FIRST,from), end = Math.min(LAST,to);
        return start> end ? "" : `<rect class="${cls}" x="${x(start)}" y="${top}" width="${Math.max(2,x(end)-x(start))}" height="${bottom-top}"/>`;
      };
      const ticks = Array.from({length:5}, (_, i) => {
        const v = low + (high-low)*i/4;
        return `<line class="grid" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text text-anchor="end" x="${left-11}" y="${y(v)+4}">${html(amount(v,kind))}</text>`;
      }).join("");
      const labels = [...new Set([FIRST,...availableYears.filter(v => v>FIRST && v < availableYears.at(-1)&&v%5===0),availableYears.at(-1)])].map(
        year=>`<text x="${x(year)}" y="${bottom+23}" text-anchor="middle">${year}</text>`).join("");
      const traces = keys.map(key => {
        const points = availableYears.map((year,i)=>({year,value:rows[i]?.[key]}));
        const c = defs[key][2];
        if (options.bars) return points.filter(p=>finite(p.value)).map(p=>{
          const zero = y(0), py = y(p.value);
          return `<rect class="data-bar" x="${x(p.year)-9}" y="${Math.min(zero,py)}" width="18" height="${Math.max(1,Math.abs(zero-py))}" rx="3" fill="${p.value>=0 ? GREEN : "#b95d57"}"/>`;
        }).join("") + `<line x1="${left}" x2="${right}" y1="${y(0)}" y2="${y(0)}" stroke="#789084"/>`;
        const p=options.smooth?smoothPath:pathFor;
        return `<path class="series-trace" d="${p(points,p=>x(p.year),p=>y(p.value))}" stroke="${c}" stroke-width="${options.smooth?1.55:1.7}" fill="none" stroke-linecap="round"/>`+
          (options.smooth?"":points.filter(p=>finite(p.value)).map(p=>`<circle class="annual-marker" cx="${x(p.year)}" cy="${y(p.value)}" r="2.5" fill="${c}"/>`).join(""));
      }).join("");
      const peak = rows.reduce((best,r) => finite(r?.[keys[0]]) && (!best || r[keys[0]] > best[keys[0]]) ? r : best,null);
      const trough = rows.reduce((best,r) => finite(r?.[keys[0]]) && (!best || r[keys[0]] < best[keys[0]]) ? r : best,null);
      const annotated=(record,label,tone)=>{
        const mx=x(record.year), my=y(record[keys[0]]), box=111,
          bx=Math.max(left,Math.min(right-box,mx-box/2)), by=Math.max(0,my-42);
        return `<g class="turning-point ${tone}"><line x1="${mx}" x2="${mx}" y1="${by+23}" y2="${bottom}"/>
          <circle class="point-halo" cx="${mx}" cy="${my}" r="8.2"/><circle class="point-dot" cx="${mx}" cy="${my}" r="4.0"/>
          <rect x="${bx}" y="${by}" width="${box}" height="23" rx="6"/><text x="${bx+box/2}" y="${by+15}" text-anchor="middle">${label} · ${amount(record[keys[0]],kind)}</text></g>`;
      };
      const marker = options.smooth && peak ? annotated(peak,"Peak","high")+(trough&&trough!==peak?annotated(trough,"Low","low"):"")
        : options.showRange && peak ? `<circle cx="${x(peak.year)}" cy="${y(peak[keys[0]])}" r="6" fill="#fff" stroke="${defs[keys[0]][2]}" stroke-width="2"/>
        <text class="peak" x="${x(peak.year)}" y="${Math.max(13,y(peak[keys[0]])-11)}" text-anchor="middle">Peak · ${peak.year}</text>` : "";
      const bandWidth = (right-left)/Math.max(1,availableYears.length-1);
      const hit = availableYears.map((year,i) => {
        if (!keys.some(key=>finite(rows[i]?.[key]))) return "";
        const tip = keys.length === 1 ? this.detail(keys[0],rows[i],year) : `<b>${html(s.area)} · ${year}</b>` +
          keys.map(key=>`<span>${defs[key][0]} <strong>${amount(rows[i]?.[key], defs[key][1])}</strong></span>`).join("") +
          `<span>Net fixed investment <strong>${amount(rows[i]?.net,"money")}</strong></span><span>Investment YoY <strong>${changeText(rows[i]?.invY,"percent")}</strong></span>`;
        return `<rect class="hit" data-tip="${html(tip)}" tabindex="0" aria-label="${year} values" x="${x(year)-bandWidth/2}" y="${top}" width="${bandWidth}" height="${bottom-top}"/>`;
      }).join("");
      const periodSize = s.hi-s.lo+1;
      return `<svg class="plot" ${options.showRange ? `data-brush data-left="${left}" data-right="${right}"` : ""} viewBox="0 0 ${wide} ${h}" aria-label="Annual data chart" role="group">
        ${options.showRange ? (s.comparison === "window" ? rangeBox(s.lo-periodSize,s.lo-1,"prior-band") : "") + rangeBox(s.lo,s.hi,"focus-band") : ""}
        ${ticks}${labels}${traces}${marker}${hit}<rect class="brush-preview" x="0" y="${top}" height="${bottom-top}" width="0"/></svg>`;
    }
    benchmark() {
      const s = this.state, label = defs[s.rank][0], kind = defs[s.rank][1];
      const rows = this.peers(s.type,s.year).filter(row => [row.stock,row.va,row.inv,row.share].some(finite));
      const eligible = rows.filter(row => finite(row.stock) && finite(row.va));
      const mx = median(eligible.map(r => r.stock)), my = median(eligible.map(r=>r.va));
      const quadrant = row => !finite(row.stock) || !finite(row.va) ? "" : `${row.stock >= mx ? "above" : "below"}-${row.va >= my ? "above" : "below"}`;
      const chosen = rows.filter(r => !s.quadrant || quadrant(r)===s.quadrant);
      const tableData = chosen.sort((a,b)=>(b[s.rank]??-Infinity)-(a[s.rank]??-Infinity) || a.area.localeCompare(b.area));
      const top = tableData.filter(row=>finite(row[s.rank])).slice(0,10);
      const scale = Math.max(...top.map(r=>r[s.rank]), 0.00001);
      const bars = top.length ? top.map((row,index)=>`<button class="rank-row ${row.area===s.focus?"focus-row":""}" data-focus="${html(row.area)}" data-tip="${html(this.detail(s.rank,row,s.year,row.area))}"><small>${index+1}</small><span>${flag(row)}${html(row.area)}</span><i style="--fill:${Math.max(1,100*row[s.rank]/scale)}%"></i><strong>${amount(row[s.rank],kind)}</strong></button>`).join("") : `<div class="blank">No comparable observations.</div>`;
      this.tableData = tableData;
      this.filterPeers();
      return `<div class="bench-grid"><section class="panel rank"><div class="panel-head"><div><h2>Area ranking</h2><p>Top 10 · ${html(label)} · ${s.year}</p></div></div>
        ${this.seg([["stock","Stock"],["inv","Investment"],["va","Value added"],["share","GDP share"]],"rank")}
        <div class="rank-body">${bars}</div></section>
        <section class="panel quadrant"><div class="panel-head"><div><h2>Value added vs. capital stock</h2><p>Shading and dashed lines mark the peer medians.</p></div>${s.quadrant ? '<button data-command="clear-quadrant">Clear quadrant</button>' : ''}</div>
        ${this.scatter(eligible,mx,my,quadrant)}<p class="chart-note">${eligible.length} comparable areas · Select a point to highlight it or a shaded region to filter the table.</p></section></div>
        <section class="panel table-panel"><div class="panel-head"><div><h2>Peer details</h2><p><span data-peer-count>${this.filteredPeers.length}</span> areas · six-year stock trend</p></div><input type="search" data-search placeholder="Search areas" aria-label="Search areas" value="${html(s.query)}"></div>
        <div class="table-scroll" role="region" tabindex="0" aria-label="Peer details table. Scroll to see more areas."><table aria-rowcount="${this.filteredPeers.length+1}"><thead><tr aria-rowindex="1"><th>Area</th><th>Investment</th><th>Net stock</th><th>GDP share</th><th>Investment YoY</th><th>Net stock trend</th></tr></thead><tbody></tbody></table></div></section>`;
    }
    filterPeers() {
      const query=this.state.query.trim().toLowerCase();
      this.filteredPeers=query ? this.tableData.filter(r=>r.area.toLowerCase().includes(query)) : this.tableData;
    }
    drawPeerRows(pane) {
      const s=this.state, rows=this.filteredPeers, count=rows.length;
      const table=pane.querySelector("table"), body=table.tBodies[0];
      const first=Math.max(0,Math.floor(pane.scrollTop/PEER_ROW_HEIGHT)-PEER_OVERSCAN);
      const last=Math.min(count,first+Math.ceil(pane.clientHeight/PEER_ROW_HEIGHT)+PEER_OVERSCAN*2);
      const windowKey=`${s.query}\n${first}\n${last}`;
      if (body.dataset.window===windowKey) return;
      body.dataset.window=windowKey;
      table.setAttribute("aria-rowcount",String(count+1));
      if (!count) { body.innerHTML='<tr><td colspan="6">No matching areas.</td></tr>';return; }
      const spacer=n=>n>0?`<tr class="peer-spacer" aria-hidden="true"><td colspan="6" style="height:${n*PEER_ROW_HEIGHT}px"></td></tr>`:"";
      body.innerHTML=spacer(first)+rows.slice(first,last).map((r,i) => `<tr data-peer-row aria-rowindex="${first+i+2}" class="${s.focus===r.area?"table-focus":""}"><td><button class="table-name" data-focus="${html(r.area)}">${flag(r)}${html(r.area)}</button></td>
        <td>${amount(r.inv,"money")}</td><td>${amount(r.stock,"money")}</td><td>${amount(r.share,"percent")}</td><td>${pill(r.invY,"percent")}</td>
        <td>${spark(Array.from({length:6},(_,i)=>this.row(r.area,s.year-5+i)),"stock")}</td></tr>`).join("")+spacer(count-last);
    }
    scatter(rows, mx, my, quadrant) {
      if (!rows.length) return '<div class="blank">No areas have both measures.</div>';
      const s = this.state, left=61, right=646, top=23, bottom=251;
      const xmin = Math.min(...rows.map(r=>r.stock),0), ymin=Math.min(...rows.map(r=>r.va),0);
      const xmax = Math.max(...rows.map(r=>r.stock),1), ymax=Math.max(...rows.map(r=>r.va),1);
      const tx = v => Math.asinh(v/Math.max(1,Math.abs(mx)/5));
      const ty = v => Math.asinh(v/Math.max(1,Math.abs(my)/5));
      const x = v => left+(right-left)*(tx(v)-tx(xmin))/(tx(xmax)-tx(xmin));
      const y = v => bottom-(bottom-top)*(ty(v)-ty(ymin))/(ty(ymax)-ty(ymin));
      const splitX=x(mx), splitY=y(my);
      const zones = [
        ["below-above",left,top,splitX-left,splitY-top,"#eee7f1"],["above-above",splitX,top,right-splitX,splitY-top,"#dce8f4"],
        ["below-below",left,splitY,splitX-left,bottom-splitY,"#f5e3de"],["above-below",splitX,splitY,right-splitX,bottom-splitY,"#e7ebf1"],
      ].map(([key,px,py,w,h,fill])=>`<rect data-quadrant="${key}" tabindex="0" role="button" aria-label="${key.replace("-", " capital stock, ")} value added" x="${px}" y="${py}" width="${w}" height="${h}" fill="${fill}" opacity="${s.quadrant && s.quadrant !== key ? .45 : 1}"/>`).join("");
      const dots = rows.slice().sort((a,b)=>Number(a.area===s.focus)-Number(b.area===s.focus)).map(r=>{
        const focus = r.area===s.focus, dim=s.quadrant && s.quadrant!==quadrant(r);
        const tip=`<b>${html(r.area)} · ${s.year}</b><span>Net capital stock <strong>${amount(r.stock,"money")}</strong></span><span>Sector value added <strong>${amount(r.va,"money")}</strong></span><span>Value added per dollar of stock <strong>${amount(r.prod,"ratio")}</strong></span><span>Investment orientation <strong>${amount(r.aoi,"ratio")}</strong></span>`;
        return `<circle tabindex="0" role="button" aria-label="${html(r.area)}" class="dot" data-focus="${html(r.area)}" data-tip="${html(tip)}" cx="${x(r.stock)}" cy="${y(r.va)}" r="${focus?7:4.4}" fill="${focus?BLUE:"#52739D"}" opacity="${dim ? .24 : focus ? 1 : .76}"/>`;
      }).join("");
      return `<svg class="plot scatter" viewBox="0 0 670 299" aria-label="Capital stock and value added by area">
        <text class="axis-heading" x="${left}" y="14">Sector value added</text>${zones}
        <path d="M${splitX},${top}V${bottom} M${left},${splitY}H${right}" stroke="#7c9485" stroke-dasharray="5 4" pointer-events="none"/>
        ${dots}<text x="${left}" y="${bottom+18}">${amount(xmin,"money")}</text><text text-anchor="end" x="${right}" y="${bottom+18}">${amount(xmax,"money")}</text>
        <text text-anchor="end" x="${left-6}" y="${top+4}">${amount(ymax,"money")}</text>
        <text class="axis-heading" text-anchor="middle" x="${(left+right)/2}" y="294">Net capital stock · asinh scales</text></svg>`;
    }
    click(event) {
      const overlay=this.root.querySelector(".help-overlay");
      if (event.target===overlay) { this.showHelp(false); return; }
      const el = event.target.closest("button,[data-focus],[data-quadrant],[data-flip],[data-map]");
      if (!el) return;
      const a = el.dataset, s = this.state;
      if (a.mapZoom) { this.zoomMap(a.mapZoom); return; }
      if (a.map && event.detail>0 && this.suppressMapClick) return;
      if (a.command === "help") {
        this.showHelp(overlay.hidden);
        return;
      }
      if (a.page) {
        this.root.dispatchEvent(new CustomEvent("report-navigate", { detail:a.page }));
        return;
      }
      if (a.flip) {
        if (s.flipped.has(a.flip)) s.flipped.delete(a.flip);
        else s.flipped.add(a.flip);
        el.classList.toggle("turned",s.flipped.has(a.flip));
        return;
      }
      let handled = true;
      if (a.type) { s.type=a.type; s.quadrant=""; }
      else if (a.state) s[a.state]=a.value;
      else if (a.focus) s.focus=a.focus;
      else if (a.map) { s.type=a.mapType; s.area=a.map; this.focusOnMap=a.map; }
      else if (a.quadrant) s.quadrant=s.quadrant===a.quadrant ? "" : a.quadrant;
      else if (a.command==="clear-quadrant") s.quadrant="";
      else if (a.preset) { s.hi=LAST; s.lo=a.preset==="all" ? FIRST : LAST-Number(a.preset)+1; }
      else handled=false;
      if (handled) {
        this.render();
        if (this.focusOnMap && event.detail===0) {
          Array.from(this.root.querySelectorAll("[data-map]")).find(node=>node.dataset.map===this.focusOnMap)?.focus();
        }
        this.focusOnMap=null;
      }
    }
    showHelp(show) {
      const overlay=this.root.querySelector(".help-overlay"), support=this.root.querySelector(".support");
      overlay.hidden=!show;
      support.setAttribute("aria-expanded",String(show));
      this.root.querySelector(".atlas-layout").inert=show;
      this.root.querySelector(".fn-tooltip").hidden=true;
      if (show) overlay.querySelector("button").focus(); else support.focus();
    }
    handleKey(event) {
      const overlay=this.root.querySelector(".help-overlay");
      if (event.target.matches("[data-map-canvas]") && overlay?.hidden) {
        const actions={"+":"in","=":"in","-":"out","0":"reset"};
        if (actions[event.key]) {
          event.preventDefault();
          this.zoomMap(actions[event.key]);
        } else {
          const offsets={ArrowLeft:[30,0],ArrowRight:[-30,0],ArrowUp:[0,30],ArrowDown:[0,-30]};
          const move=offsets[event.key];
          if (move && this.mapView.step>0) {
            event.preventDefault();
            this.moveMapTo(this.mapView.x+move[0],this.mapView.y+move[1]);
          }
        }
      }
      if (!overlay?.hidden && event.key==="Escape") {
        event.preventDefault();
        this.showHelp(false);
      } else if (!overlay?.hidden && event.key==="Tab") {
        event.preventDefault();
        overlay.querySelector("button").focus();
      } else if (["Enter"," "].includes(event.key) && event.target.matches("[role=button]:not(button)")) {
        event.preventDefault();
        event.target.dispatchEvent(new MouseEvent("click",{bubbles:true}));
      }
    }
    change(event) {
      const key=event.target.dataset.select;
      if (!key) return;
      this.state[key]=["year","lo","hi"].includes(key) ? Number(event.target.value) : event.target.value;
      this.render();
      this.root.querySelector(`[data-select="${key}"]`)?.focus();
    }
    search(event) {
      if (!event.target.matches("[data-search]")) return;
      this.state.query=event.target.value;
      this.filterPeers();
      this.root.querySelector("[data-peer-count]").textContent=this.filteredPeers.length;
      const pane=this.root.querySelector(".table-scroll");
      pane.scrollTop=0;
      this.drawPeerRows(pane);
    }
    scrollPeers(event) {
      const table=event.target.closest(".table-scroll");
      if (!table || event.ctrlKey || table.scrollHeight<=table.clientHeight || !event.deltaY) return;
      const pixels=event.deltaMode===1?18:event.deltaMode===2?table.clientHeight:1;
      event.preventDefault();
      event.stopPropagation();
      table.scrollTop+=event.deltaY*pixels;
    }
    tooltip(event) {
      const from = event.target.closest("[data-tip]"), tip = this.root.querySelector(".fn-tooltip");
      if (!from || !tip || this.drag || this.mapDrag?.moved) return;
      const stage = tip.parentElement, parent = stage.getBoundingClientRect(), node = from.getBoundingClientRect();
      const unit = parent.width / stage.offsetWidth || 1;
      tip.innerHTML=from.dataset.tip;
      tip.hidden=false;
      const px=event.type==="focusin" ? node.left+node.width/2 : event.clientX;
      const py=event.type==="focusin" ? node.top : event.clientY;
      const x=(px-parent.left)/unit, y=(py-parent.top)/unit;
      const below=y<tip.offsetHeight+22;
      const tx=Math.max(9,Math.min(stage.offsetWidth-tip.offsetWidth-9,x-tip.offsetWidth/2));
      tip.classList.toggle("tip-below",below);
      tip.style.left=`${tx}px`;
      tip.style.top=`${below?y+16:y-tip.offsetHeight-15}px`;
      tip.style.setProperty("--tip-anchor",`${Math.max(16,Math.min(tip.offsetWidth-16,x-tx))}px`);
    }
    hideTooltip(event) {
      if (event.relatedTarget?.closest?.("[data-tip]") === event.target.closest?.("[data-tip]")) return;
      const tip=this.root.querySelector(".fn-tooltip");
      if (tip) tip.hidden=true;
    }
    brushX(event, svg) {
      const bounds=svg.getBoundingClientRect(), view=svg.viewBox.baseVal;
      return (event.clientX-bounds.left)*view.width/bounds.width;
    }
    startBrush(event) {
      const svg=event.target.closest("[data-brush]");
      if (!svg || event.button!==0) return;
      this.drag={svg,x:this.brushX(event,svg)};
      svg.setPointerCapture(event.pointerId);
      this.root.querySelector(".fn-tooltip").hidden=true;
    }
    moveBrush(event) {
      if (!this.drag) return;
      const {svg,x}=this.drag, next=this.brushX(event,svg), rect=svg.querySelector(".brush-preview");
      rect.setAttribute("x",String(Math.min(x,next)));rect.setAttribute("width",String(Math.abs(x-next)));
    }
    endBrush(event) {
      if (!this.drag) return;
      const {svg,x}=this.drag, next=this.brushX(event,svg), left=Number(svg.dataset.left), right=Number(svg.dataset.right);
      this.drag=null;
      if (Math.abs(next-x)<12) { svg.querySelector(".brush-preview").setAttribute("width","0");return; }
      const toYear = px => Math.round(FIRST+(LAST-FIRST)*Math.max(0,Math.min(1,(px-left)/(right-left))));
      this.state.lo=toYear(Math.min(x,next));this.state.hi=toYear(Math.max(x,next));this.render();
    }
  }

  class Visual {
    constructor(options, mode) {
      this.host=options.host;
      this.report=new Report(document.createElement("div"),mode);
      options.element.replaceChildren(this.report.root);
    }
    update(options) {
      this.host?.eventService?.renderingStarted?.(options);
      try {
        const table=options.dataViews?.[0]?.table;
        const rows=(table?.rows || []).map(row=>Object.fromEntries(table.columns.map((column,i)=>{
          const role=Object.keys(column.roles||{}).find(key=>column.roles[key]);
          return [role || column.displayName,row[i]];
        })));
        this.report.update(rows,options.viewport.width,options.viewport.height);
        this.host?.eventService?.renderingFinished?.(options);
      } catch (error) {
        this.report.root.textContent="Capital Atlas could not render these observations.";
        this.host?.eventService?.renderingFailed?.(options,String(error));
      }
    }
  }

  return { Report, Visual };
})();
