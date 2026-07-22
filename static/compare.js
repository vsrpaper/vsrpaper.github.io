/* =========================================================================
   Interactive 8K comparison viewer  (vanilla JS, no dependencies)
   - Navigator: downscaled 8K frame with clickable crop cells
   - Two viewing modes the visitor chooses between:
       * Flip   : one method shown full-frame; toggle A/B in place (Space/click)
       * Slider : two methods side by side with a draggable divider
   - Lazy loading: only the A/B methods for the open crop are fetched
   ========================================================================= */
(function () {
  "use strict";

  // ---- CONFIG -------------------------------------------------------------
  const CFG = {
    // Clips live as GitHub Release assets (flat bucket — filenames from srcOf()
    // are already unique across datasets), NOT in the repo. Byte-range capable,
    // so seeking and frame-stepping work. To serve a re-encode, upload under a
    // new tag and bump v1 here; replacing assets in place hits a stale CDN cache.
    // For local preview, swap back to: (ds) => "scripts/crops_out_" + ds.toLowerCase() + "/"
    base: () => "https://github.com/vsrpaper/vsrpaper.github.io/releases/download/v1/",

    fps: 30,

    // Display order of the method chips. `ours` gets a star; `gt` is the ref.
    methods: [
      { id: "gt",      label: "GT" },
      { id: "Ours",    label: "Ours", ours: true },
      { id: "STAVSR",  label: "ST-AVSR" },
      { id: "BFSTVSR", label: "BF-STVSR" },
      { id: "IART",    label: "IART" },
      { id: "RVRT",    label: "RVRT" },
      { id: "VRT",     label: "VRT" },
      { id: "UAV",     label: "UAV" },
      { id: "SCST",    label: "SCST" },
      { id: "DiQP",    label: "DiQP" }
    ],

    datasets: {
      SEPE:  { label: "SEPE",  tag: 26, cols: 16, rows: 8,
               nav: "static/figures/nav_SEPE.jpg",  crops: [29, 36, 38, 65, 79] },
      VIDEA: { label: "VIDEA", tag: 20, cols: 16, rows: 8,
               nav: "static/figures/nav_VIDEA.jpg", crops: [1, 15, 74, 109] }
    },

    // full-clip metrics per dataset (arrow marks better direction; best value is bolded)
    metricDefs: [
      { key: "psnr",  label: "PSNR",  arrow: "↑", dp: 2, better: "max" },
      { key: "ssim",  label: "SSIM",  arrow: "↑", dp: 3, better: "max" },
      { key: "lpips", label: "LPIPS", arrow: "↓", dp: 3, better: "min" },
      { key: "dists", label: "DISTS", arrow: "↓", dp: 3, better: "min" },
      { key: "vmaf",  label: "VMAF",  arrow: "↑", dp: 1, better: "max" }
    ],
    // values as [psnr, ssim, lpips, dists, vmaf]; Ours first, then baselines
    metrics: {
      SEPE: {
        Ours:    [29.593518751520776, 0.9714008890665494, 0.422990448224704,  0.005199811729699074, 70.8381],
        STAVSR:  [28.373006246560394, 0.8718548542679752, 0.4521230142002919, 0.008812119729542812, 52.4680],
        BFSTVSR: [25.486716803100993, 0.7477945882739829, 0.5394614633658658, 0.06745545561098334,  52.6000],
        IART:    [18.53009284067962,  0.5836525574579077, 0.6133046671495599, 0.20200933561486714,  55.2958],
        RVRT:    [25.195164981130826, 0.6713838682336323, 0.5743199657080538, 0.04565015324091507,  48.2108],
        VRT:     [25.192332219269318, 0.670928269119586,  0.57593739381281,   0.04606485245591503,  47.9062],
        UAV:     [22.770689769732115, 0.733806060907434,  0.49362543830803807, 0.22188998205605956, 61.1766],
        SCST:    [28.21435499669716,  0.9525129681446879, 0.46287765839825507, 0.10684620516754711, 54.1578],
        DiQP:    [27.90839222406937,  0.8658702609902721, 0.48217778271537715, 0.04034713365263858, 45.9059]
      },
      VIDEA: {
        Ours:    [30.492287441240904, 0.9851915732673977, 0.29035789722632804, 0.0087017408980175,  80.2745],
        STAVSR:  [29.697942331881826, 0.9236822598753964, 0.35550700377261757, 0.01814028590817914, 64.0351],
        BFSTVSR: [23.232255189315133, 0.7821088825978563, 0.3840818364783673,  0.12181250347341582, 59.3235],
        IART:    [22.4594, 0.7779, 0.3241, 0.4044, 70.7279],
        RVRT:    [23.6343, 0.5847, 0.3873, 0.2203, 58.7300],
        VRT:     [23.5341, 0.5839, 0.3837, 0.2247, 57.8700],
        UAV:     [15.352831875600145, 0.59264349698223,  0.4137661697772833, 0.2490036258330712,  70.2671],
        SCST:    [29.976396375675264, 0.9543935949587105, 0.35378259056587286, 0.07710277874732895, 67.0382],
        DiQP:    [27.346506273948542, 0.8685634443315409, 0.37953041612596833, 0.0602898662373171,  48.0005]
      }
    }
  };

  const labelOf = (id) => (CFG.methods.find((m) => m.id === id) || {}).label || id;
  const isOurs  = (id) => !!(CFG.methods.find((m) => m.id === id) || {}).ours;

  // Basename shared by the clip (remote Release asset, .mp4) and its poster frame
  // (in-repo .webp, ~7 KB) so the two can never drift apart.
  function nameOf(ds, id, crop) {
    const d = CFG.datasets[ds];
    return id === "gt"
      ? ds + "_gt_" + d.tag + "_crop" + crop
      : id + "_" + ds + "_16x_" + d.tag + "_crop" + crop;
  }
  const srcOf    = (ds, id, crop) => CFG.base(ds) + nameOf(ds, id, crop) + ".mp4";
  const posterOf = (ds, id, crop) => "static/posters/" + nameOf(ds, id, crop) + ".webp";
  function cell(crop, cols) { const i = crop - 1; return { col: i % cols, row: Math.floor(i / cols) }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (t) => (isFinite(t) ? t.toFixed(1) + "s" : "0.0s");

  // clip-path for one side, honoring split % and orientation (v = left/right, h = top/bottom)
  function clipFor(side) {
    const s = state.split;
    if (state.orient === "v")
      return side === "A" ? "inset(0 " + (100 - s) + "% 0 0)" : "inset(0 0 0 " + s + "%)";
    return side === "A" ? "inset(0 0 " + (100 - s) + "% 0)" : "inset(" + s + "% 0 0 0)";
  }

  // ---- STATE --------------------------------------------------------------
  const state = {
    ds: "SEPE",
    crop: CFG.datasets.SEPE.crops[0],
    mode: "flip",      // "flip" | "slider"
    orient: "v",       // slider split direction: "v" left/right, "h" top/bottom
    A: "Ours",
    B: "gt",
    showing: "A",      // which side is visible in flip mode
    split: 50,         // slider divider position (%)
    zoom: 1,
    playing: false     // start paused: let clips buffer while the visitor reads/scrolls
  };

  const pool = new Map();  // methodId -> <video>  (for the current ds+crop only)
  let lastMasterT = 0;     // for loop-wrap detection in the sync loop
  let gating = false;      // true while we wait for both clips to buffer before starting together
  let restartGen = 0;      // generation token: cancels superseded gated launches
  let restartTimer = null, restartTimeout = null;
  let rafRunning = false;  // the sync rAF loop runs ONLY while playing (idle = no wakeups)

  // ---- DOM refs (filled in build) ----------------------------------------
  let root, tabs, navFrame, metricsBox, stage, stageInner, dividerEl, flipPill, dragHint, stagePlay,
      labL, labR, labC, playBtn, scrub, tlabel, chooserA, chooserB, metaline, modeSeg, orientSeg, sideA, sideB;

  // =========================================================================
  function build() {
    root = document.getElementById("cmp");
    if (!root) return;

    root.innerHTML =
      '<div class="cmp-tabs" role="tablist"></div>' +
      '<div class="cmp-body">' +
        '<div class="cmp-nav">' +
          '<div class="nav-frame" id="navFrame"><div class="nav-grid"></div></div>' +
          '<p class="nav-hint">Highlighted cells are the available regions of the 8K frame. Click one to compare all methods.</p>' +
          '<div class="cmp-metrics" id="cmpMetrics"></div>' +
        '</div>' +
        '<div class="cmp-viewer">' +
          '<div class="cmp-modebar">' +
            '<span class="seg" id="modeSeg">' +
              '<button data-mode="flip">Flip</button>' +
              '<button data-mode="slider">Slider</button>' +
            '</span>' +
            '<span class="split-label orient-only">Split</span>' +
            '<span class="seg orient-only" id="orientSeg">' +
              '<button data-orient="v" title="Side-by-side (left / right)">&#8596; Sides</button>' +
              '<button data-orient="h" title="Over-under (top / bottom)">&#8597; Stack</button>' +
            '</span>' +
            '<span class="modebar-spacer"></span>' +
            '<span class="zoomlbl">Zoom</span>' +
            '<span class="seg" id="zoomSeg">' +
              '<button data-z="1">1&times;</button>' +
              '<button data-z="2">2&times;</button>' +
              '<button data-z="4">4&times;</button>' +
            '</span>' +
          '</div>' +
          '<div class="cmp-stage" id="stage">' +
            '<div class="stage-inner" id="stageInner"></div>' +
            '<span class="pane-label left"  id="labL"></span>' +
            '<span class="pane-label right" id="labR"></span>' +
            '<span class="pane-label center" id="labC"></span>' +
            '<div class="divider" id="divider"><span class="knob"></span></div>' +
            '<span class="drag-hint" id="dragHint">drag to compare</span>' +
            '<button class="stage-play" id="stagePlay" aria-label="Play">&#9654;</button>' +
            '<button class="flip-pill" id="flipPill"></button>' +
          '</div>' +
          '<div class="cmp-transport">' +
            '<button id="playBtn" title="Play / pause">&#10073;&#10073;</button>' +
            '<button id="stepB" title="Previous frame">&#9664;</button>' +
            '<input type="range" id="scrub" min="0" max="100" value="0" step="0.01">' +
            '<button id="stepF" title="Next frame">&#9654;</button>' +
            '<span class="tlabel" id="tlabel">0.0s</span>' +
          '</div>' +
          '<div class="chooser">' +
            '<div class="chooser-row row-A"><span class="side" id="sideA">A</span><span class="chips" id="chooserA"></span></div>' +
            '<div class="chooser-row row-B"><span class="side" id="sideB">B</span><span class="chips" id="chooserB"></span></div>' +
          '</div>' +
          '<p class="metaline" id="metaline"></p>' +
        '</div>' +
      '</div>';

    tabs       = root.querySelector(".cmp-tabs");
    navFrame   = root.querySelector("#navFrame");
    metricsBox = root.querySelector("#cmpMetrics");
    stage      = root.querySelector("#stage");
    stageInner = root.querySelector("#stageInner");
    dividerEl  = root.querySelector("#divider");
    flipPill   = root.querySelector("#flipPill");
    dragHint   = root.querySelector("#dragHint");
    stagePlay  = root.querySelector("#stagePlay");
    labL = root.querySelector("#labL"); labR = root.querySelector("#labR"); labC = root.querySelector("#labC");
    playBtn = root.querySelector("#playBtn");
    scrub   = root.querySelector("#scrub");
    tlabel  = root.querySelector("#tlabel");
    chooserA = root.querySelector("#chooserA");
    chooserB = root.querySelector("#chooserB");
    sideA = root.querySelector("#sideA");
    sideB = root.querySelector("#sideB");
    metaline = root.querySelector("#metaline");
    modeSeg  = root.querySelector("#modeSeg");
    orientSeg = root.querySelector("#orientSeg");

    // dataset tabs
    Object.keys(CFG.datasets).forEach((ds) => {
      const b = document.createElement("button");
      b.className = "cmp-tab" + (ds === state.ds ? " active" : "");
      b.textContent = CFG.datasets[ds].label;
      b.onclick = () => selectDataset(ds);
      tabs.appendChild(b);
    });

    // method chips
    buildChips(chooserA, "A");
    buildChips(chooserB, "B");

    // mode + zoom
    modeSeg.querySelectorAll("button").forEach((b) =>
      (b.onclick = () => setMode(b.dataset.mode)));
    orientSeg.querySelectorAll("button").forEach((b) =>
      (b.onclick = () => setOrient(b.dataset.orient)));
    root.querySelector("#zoomSeg").querySelectorAll("button").forEach((b) =>
      (b.onclick = () => setZoom(parseFloat(b.dataset.z))));

    // transport
    playBtn.onclick = () => setPlaying(!state.playing);
    stagePlay.onclick = () => setPlaying(true);
    root.querySelector("#stepF").onclick = () => step(1);
    root.querySelector("#stepB").onclick = () => step(-1);
    scrub.addEventListener("input", () => seekTo((parseFloat(scrub.value) / 100) * duration(), true));

    // flip interactions
    flipPill.onclick = flip;
    stage.addEventListener("click", (e) => {
      if (state.mode === "flip" && !e.target.closest(".flip-pill")) flip();
    });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && isInView(stage)) { e.preventDefault(); if (state.mode === "flip") flip(); else setPlaying(!state.playing); }
    });

    // zoom lens follow
    stage.addEventListener("mousemove", (e) => {
      if (state.zoom === 1) return;
      const r = stage.getBoundingClientRect();
      stageInner.style.transformOrigin =
        ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%";
    });

    setupDivider();
    selectDataset(state.ds, true);
    setZoom(1);       // mark 1x active
    setOrient("v");   // mark left/right active
    // note: the sync rAF loop is NOT started here — it starts on play (see startTick)
  }

  // ---- chips --------------------------------------------------------------
  function buildChips(host, side) {
    host.innerHTML = "";
    CFG.methods.forEach((m) => {
      const c = document.createElement("button");
      c.className = "chip" + (m.ours ? " ours" : "");
      c.textContent = m.label;
      c.dataset.mid = m.id;
      c.onclick = () => setSide(side, m.id);
      host.appendChild(c);
    });
  }
  function refreshChips() {
    chooserA.querySelectorAll(".chip").forEach((c) => c.classList.toggle("sel", c.dataset.mid === state.A));
    chooserB.querySelectorAll(".chip").forEach((c) => c.classList.toggle("sel", c.dataset.mid === state.B));
  }

  // ---- dataset / crop -----------------------------------------------------
  function selectDataset(ds, force) {
    if (ds === state.ds && !force) return;
    state.ds = ds;
    tabs.querySelectorAll(".cmp-tab").forEach((b, i) =>
      b.classList.toggle("active", Object.keys(CFG.datasets)[i] === ds));
    buildNav();
    buildMetrics();
    openCrop(CFG.datasets[ds].crops[0]);
  }

  function buildMetrics() {
    const data = CFG.metrics[state.ds];
    if (!data || !metricsBox) return;
    const defs = CFG.metricDefs;
    const keys = Object.keys(data);
    // best value in each metric column
    const best = defs.map((d, i) => {
      const vals = keys.map((k) => data[k][i]);
      return d.better === "max" ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
    });
    const tag = CFG.datasets[state.ds].tag;
    let h = '<div class="metrics-head">Metrics · <span>' + state.ds + " video " + tag + "</span></div>";
    h += '<table class="metrics-table"><thead><tr><th>Model</th>';
    defs.forEach((d) => { h += "<th>" + d.label + '<i>' + d.arrow + "</i></th>"; });
    h += "</tr></thead><tbody>";
    keys.forEach((k) => {
      h += '<tr class="' + (k === "Ours" ? "ours" : "") + '"><td>' + labelOf(k) + "</td>";
      defs.forEach((d, i) => {
        const isBest = Math.abs(data[k][i] - best[i]) < 1e-9;
        h += '<td class="' + (isBest ? "best" : "") + '">' + data[k][i].toFixed(d.dp) + "</td>";
      });
      h += "</tr>";
    });
    h += "</tbody></table>";
    h += '<div class="metrics-note">Scores for the clip shown (source video ' + tag +
         "). Best in bold; ↑ higher / ↓ lower is better.</div>";
    metricsBox.innerHTML = h;
  }

  function buildNav() {
    const d = CFG.datasets[state.ds];
    // wipe everything except the grid overlay
    navFrame.querySelectorAll(".nav-img,.nav-hot").forEach((n) => n.remove());
    navFrame.classList.remove("nav-missing");
    navFrame.dataset.ds = state.ds;

    const img = document.createElement("img");
    img.className = "nav-img";
    img.src = d.nav;
    img.alt = state.ds + " 8K frame";
    img.onerror = () => navFrame.classList.add("nav-missing");
    navFrame.insertBefore(img, navFrame.firstChild);

    d.crops.forEach((c) => {
      const { col, row } = cell(c, d.cols);
      const h = document.createElement("button");
      h.className = "nav-hot";
      h.style.left = (col / d.cols * 100) + "%";
      h.style.top = (row / d.rows * 100) + "%";
      h.style.width = (100 / d.cols) + "%";
      h.style.height = (100 / d.rows) + "%";
      h.title = "crop " + c;
      h.innerHTML = "<span>" + c + "</span>";
      h.onclick = () => openCrop(c);
      navFrame.appendChild(h);
    });
  }

  function openCrop(c) {
    state.crop = c;
    // reset defaults for a fresh comparison
    state.A = "Ours"; state.B = "gt"; state.showing = "A";
    // tear down old videos (free decoders)
    pool.forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); v.remove(); });
    pool.clear();
    // mark active hotspot
    navFrame.querySelectorAll(".nav-hot").forEach((h) =>
      h.classList.toggle("active", h.title === "crop " + c));
    render();
    // reflect current play/pause in the UI, then (re)start cleanly from frame 0
    playBtn.innerHTML = state.playing ? "&#10073;&#10073;" : "&#9654;";
    stage.classList.toggle("paused", !state.playing);
    restartActive();
    metaline.textContent =
      state.ds + " · source video " + CFG.datasets[state.ds].tag +
      " · crop " + c + " · ×16 · 512px tile";
  }

  // ---- video pool ---------------------------------------------------------
  function ensure(id) {
    if (pool.has(id)) return pool.get(id);
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    v.className = "cmp-video";
    v.dataset.mid = id;
    // Poster paints the first frame immediately from the repo, so the stage is never
    // black while the multi-MB clip comes down from the Release CDN.
    v.poster = posterOf(state.ds, id, state.crop);
    v.src = srcOf(state.ds, id, state.crop);
    stageInner.appendChild(v);
    pool.set(id, v);
    stage.classList.add("loading");
    // Clips are remote (Release assets), so a failed fetch is a normal failure mode,
    // not a bug. Without this the stage just stays black, which reads as "the page is
    // broken" rather than "one file didn't arrive".
    v.addEventListener("error", () => { v.dataset.failed = "1"; refreshError(); });
    v.addEventListener("loadeddata", () => {
      delete v.dataset.failed;
      refreshError();
      if (gating) return;   // restartActive is coordinating the loading UI + synchronized start
      stage.classList.remove("loading");
      const t = masterTime();
      try { if (Math.abs(v.currentTime - t) > 0.06) v.currentTime = t; } catch (e) {}
      if (state.playing && isActive(id)) v.play().catch(() => {});
    });
    v.load();
    return v;
  }

  // Surface load failures for whichever clips are currently on screen. Driven from
  // render(), so switching method or mode re-evaluates against the new active pair.
  function refreshError() {
    const bad = active().filter((id) => { const v = pool.get(id); return v && v.dataset.failed; });
    if (bad.length) {
      stage.classList.remove("loading");
      stage.classList.add("errored");
      stage.dataset.err = "Couldn't load " + bad.map(labelOf).join(" and ") +
        " for this crop. Check your connection, then reload.";
    } else {
      stage.classList.remove("errored");
      stage.removeAttribute("data-err");
    }
  }

  const active = () => (state.mode === "slider" ? [state.A, state.B] : [state[state.showing]]);
  const isActive = (id) => active().indexOf(id) !== -1;
  const masterVid = () => pool.get(state.mode === "slider" ? state.A : state[state.showing]);
  const masterTime = () => { const m = masterVid(); return m && isFinite(m.currentTime) ? m.currentTime : 0; };
  const duration = () => { const m = masterVid(); return m && isFinite(m.duration) ? m.duration : 0; };

  // ---- render (visibility, clips, labels, controls) -----------------------
  function render() {
    active().forEach(ensure);
    refreshError();

    pool.forEach((v, id) => {
      let show = false, clip = "", z = 0;
      if (state.mode === "slider") {
        if (id === state.A) { show = true; clip = clipFor("A"); z = 1; }
        else if (id === state.B) { show = true; clip = clipFor("B"); z = 2; }
      } else if (id === state[state.showing]) { show = true; z = 1; }
      v.style.opacity = show ? "1" : "0";
      v.style.clipPath = clip;
      v.style.webkitClipPath = clip;
      v.style.zIndex = z;
      if (!isActive(id)) v.pause();   // only A/B (per mode) ever play
    });

    // stage class per mode + orientation
    stage.classList.toggle("slider", state.mode === "slider");
    stage.classList.toggle("flip", state.mode === "flip");
    stage.classList.toggle("orient-h", state.orient === "h");
    root.classList.toggle("mode-slider", state.mode === "slider");
    dividerEl.style.setProperty("--split", state.split + "%");
    modeSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));

    // labels
    const aOurs = isOurs(state.A), bOurs = isOurs(state.B);
    labL.textContent = "A · " + labelOf(state.A);
    labR.textContent = "B · " + labelOf(state.B);
    labL.classList.toggle("ours", aOurs);
    labR.classList.toggle("ours", bOurs);
    labL.style.display = state.mode === "slider" ? "" : "none";
    labR.style.display = state.mode === "slider" ? "" : "none";
    if (state.mode === "flip") {
      const cur = state[state.showing];
      labC.style.display = "";
      labC.textContent = state.showing + " · " + labelOf(cur);
      labC.classList.toggle("ours", isOurs(cur));
    } else labC.style.display = "none";

    // flip pill text
    const other = state.showing === "A" ? "B" : "A";
    flipPill.innerHTML = "Showing <b>" + state.showing + " · " + labelOf(state[state.showing]) +
      "</b> &nbsp;—&nbsp; click or press Space → " + other + " · " + labelOf(state[other]);

    // chooser row labels reflect the current split direction
    if (state.mode === "slider") {
      sideA.textContent = state.orient === "v" ? "Left / A" : "Top / A";
      sideB.textContent = state.orient === "v" ? "Right / B" : "Bottom / B";
    } else {
      sideA.textContent = "A"; sideB.textContent = "B";
    }

    refreshChips();
  }

  // ---- interactions -------------------------------------------------------
  function setMode(m) {
    if (m === state.mode) return;
    state.mode = m;
    modeSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    render();
    restartActive();   // a newly-active pane must start in sync, not mid-clip
  }
  function setZoom(z) {
    state.zoom = z;
    stageInner.style.transform = "scale(" + z + ")";
    if (z === 1) stageInner.style.transformOrigin = "center";
    root.querySelector("#zoomSeg").querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", parseFloat(b.dataset.z) === z));
  }
  function setOrient(o) {
    state.orient = o;
    orientSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.orient === o));
    render();
  }
  function setSide(side, id) {
    state[side] = id;
    ensure(id);
    // in flip mode, viewing the side you just changed feels most natural
    if (state.mode === "flip") state.showing = side;
    render();
    restartActive();   // restart both from frame 0, gated on buffering -> clean sync
  }
  function flip() {
    const t = masterTime();
    state.showing = state.showing === "A" ? "B" : "A";
    render();
    seekTo(t, false);
    if (state.playing) setPlaying(true);
  }

  function clearRestart() {
    if (restartTimer) { clearInterval(restartTimer); restartTimer = null; }
    if (restartTimeout) { clearTimeout(restartTimeout); restartTimeout = null; }
  }
  function setPlaying(p) { if (p) startPlayback(); else pausePlayback(); }

  function pausePlayback() {
    state.playing = false;
    gating = false; clearRestart();
    playBtn.innerHTML = "&#9654;";
    stage.classList.add("paused");
    stage.classList.remove("loading");
    pool.forEach((v) => v.pause());
  }

  // Start playback with a synchronized, buffer-gated launch: both active clips are
  // seeked to a common time and only begin once both can play through, so they can
  // never start offset. A generation token cancels any superseded pending launch,
  // and gating is always cleared, so playback can't get stuck.
  function startPlayback() {
    state.playing = true;
    playBtn.innerHTML = "&#10073;&#10073;";
    stage.classList.remove("paused");
    const vids = active().map(ensure);
    const target = masterTime();
    const gen = ++restartGen;
    clearRestart();
    // A clip that already failed will never buffer; treat it as ready so a dead asset
    // costs the 100 ms poll rather than the full 8 s fail-safe below.
    const ready = () => vids.every((v) => v.readyState >= 3 || v.dataset.failed);   // HAVE_FUTURE_DATA
    const go = () => {
      if (gen !== restartGen || !state.playing) return;
      clearRestart(); gating = false; stage.classList.remove("loading");
      lastMasterT = target;
      vids.forEach((v) => { try { v.currentTime = target; } catch (e) {} v.play().catch(() => {}); });
      startTick();
    };
    if (ready()) { gating = false; go(); return; }
    gating = true; stage.classList.add("loading");
    restartTimer = setInterval(() => { if (gen === restartGen && ready()) go(); }, 100);
    restartTimeout = setTimeout(() => { if (gen === restartGen) go(); }, 8000);   // fail-safe
  }
  function seekTo(t, pause) {
    if (pause) setPlaying(false);
    pool.forEach((v, id) => {
      if (isActive(id) && v.readyState >= 1) {
        try { v.currentTime = clamp(t, 0, duration() || t); } catch (e) {}
      }
    });
    updateScrub();
  }

  // Reset the active clip(s) to frame 0, then (if we should be playing) hand off to
  // startPlayback for a gated, synchronized launch. Single-flight: clears any pending
  // launch first so overlapping switches can't leak timers or wedge `gating`.
  function restartActive() {
    clearRestart();
    gating = false;
    const vids = active().map(ensure);
    lastMasterT = 0;
    vids.forEach((v) => { v.pause(); try { v.currentTime = 0; } catch (e) {} });
    if (state.playing) startPlayback();     // target = 0 (just reset), gated on buffering
    else { stage.classList.remove("loading"); updateScrub(); }
  }
  function step(dir) {
    setPlaying(false);
    seekTo(masterTime() + dir / CFG.fps, false);
  }

  function updateScrub() {
    const d = duration();
    if (d > 0) scrub.value = (masterTime() / d) * 100;
    tlabel.textContent = fmt(masterTime());
  }

  // keep followers synced to master; refresh scrubber. Runs only while playing —
  // startTick() (re)starts it on play; it stops itself the frame playback ends.
  function startTick() { if (!rafRunning) { rafRunning = true; requestAnimationFrame(tick); } }
  function tick() {
    if (state.playing && !gating) {
      const m = masterVid();
      // watchdog: any active video that was aborted mid-load / left paused
      // (e.g. play() interrupted by its own load()) gets resumed here, so the
      // A-side can never silently stall and freeze the synced B-side.
      pool.forEach((v, id) => {
        if (isActive(id) && v.paused && v.readyState >= 2) v.play().catch(() => {});
      });
      // Keep the follower frame-locked to the master with a GENTLE proportional
      // rate nudge (<=8%, with a half-frame deadband) — no per-frame seeking, so no
      // stutter, and no visible warble once locked (rate settles back to 1). Hard
      // snap only on a loop wrap or a large stall.
      if (m && m.readyState >= 2) {
        m.playbackRate = 1;
        const t = m.currentTime;
        const wrapped = t < lastMasterT - 0.3;
        pool.forEach((v, id) => {
          if (v === m || !isActive(id) || v.readyState < 2) return;
          const diff = t - v.currentTime;               // + => follower is behind
          if (wrapped || Math.abs(diff) > 0.35) {
            try { v.currentTime = t; } catch (e) {}
            v.playbackRate = 1;
          } else if (Math.abs(diff) > 0.015) {
            v.playbackRate = clamp(1 + diff * 3, 0.92, 1.08);
          } else {
            v.playbackRate = 1;
          }
        });
        lastMasterT = t;
      }
      updateScrub();
    }
    if (state.playing) requestAnimationFrame(tick);
    else rafRunning = false;   // idle: stop waking the main thread
  }

  // ---- divider drag -------------------------------------------------------
  function setupDivider() {
    let dragging = false;
    const move = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      state.split = state.orient === "v"
        ? clamp(((clientX - r.left) / r.width) * 100, 4, 96)
        : clamp(((clientY - r.top) / r.height) * 100, 4, 96);
      dividerEl.style.setProperty("--split", state.split + "%");
      pool.forEach((v, id) => {
        if (id === state.A) v.style.clipPath = v.style.webkitClipPath = clipFor("A");
        else if (id === state.B) v.style.clipPath = v.style.webkitClipPath = clipFor("B");
      });
    };
    const down = (e) => {
      if (state.mode !== "slider") return;
      dragging = true;
      if (dragHint) dragHint.classList.add("hidden");   // hide the one-time hint once they grab it
      e.preventDefault();
    };
    dividerEl.addEventListener("mousedown", down);
    dividerEl.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("mousemove", (e) => dragging && move(e.clientX, e.clientY));
    window.addEventListener("touchmove", (e) => dragging && move(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
    window.addEventListener("mouseup", () => (dragging = false));
    window.addEventListener("touchend", () => (dragging = false));
  }

  // ---- utils --------------------------------------------------------------
  function isInView(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
  }

  // Defer building the (heavy) viewer off the critical initial render, so first load
  // isn't spent constructing the UI + fetching the first nav image and video. It builds
  // when the Comparisons section approaches the viewport (the win), OR during the first
  // idle period after load (a guaranteed fallback so it can never stay unbuilt) —
  // whichever comes first.
  function boot() {
    var el = document.getElementById("cmp");
    if (!el) return;
    var built = false;
    function go() { if (built) return; built = true; build(); }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries, obs) {
        if (entries.some(function (e) { return e.isIntersecting; })) { obs.disconnect(); go(); }
      }, { rootMargin: "600px 0px" });
      io.observe(el);
    }
    var ric = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    if (document.readyState === "complete") ric(go);
    else window.addEventListener("load", function () { ric(go); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
