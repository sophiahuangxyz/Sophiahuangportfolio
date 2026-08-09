// Letterboxd logo animation: circles spin in and form the mark, then the camera
// pulls back and pans right as the wordmark slides out. Exposes window.LogoReelVideo.
// Requires animations-v2.jsx + tweaks-panel.jsx loaded first.
(function () {
  const { SceneStage } = window;
  const { useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakColor } = window;

  const RC = { x: 400, y: 372 };            // mark center (world coords)
  const CLR = { orange: '#FF8001', blue: '#40BCF4', green: '#00E054' };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const MOTION = {
    io: (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    ramp: (v, a, b) => clamp01((v - a) / (b - a)),
  };
  const RING_DIST = 99.5, RING_R = 50;      // spread ring the circles converge from

  const ORDER = ['Logo', 'ZoomOut', 'Word', 'Hold'];
  // Scene durations, re-read from OM_SCENES so timeline edits keep the spin smooth.
  let _scnStr, _scnDur = {};
  function durs() {
    const s = window.OM_SCENES;
    if (s !== _scnStr) {
      _scnStr = s; _scnDur = {};
      try { JSON.parse(s).forEach((o) => { _scnDur[o.name] = o.dur; }); } catch (e) {}
    }
    return _scnDur;
  }
  // One continuous shot: every scene renders the same world; params accumulate.
  function stageState(name, p) {
    const idx = ORDER.indexOf(name);
    const cur = (k) => { const i = ORDER.indexOf(k); return idx > i ? 1 : idx < i ? 0 : p; };
    // Spin: one smooth cosine velocity curve over real elapsed time — the circles
    // turn as they converge and ease to rest, upright, halfway into Logo.
    const D = durs();
    let t = 0;
    for (const k of ORDER) { const d = D[k] ?? 1; if (k === name) { t += p * d; break; } t += d; }
    const T = 2.14;                                             // spin settles here (1.5s scaled to 0.7x speed)
    // 1 turn, smootherstep (zero accel at both ends) for a softer settle;
    // -360 start offset keeps the landing in brand positions.
    const u = clamp01(t / T);
    const spin = -360 + 360 * u * u * u * (u * (u * 6 - 15) + 10);
    const logoT = MOTION.io(cur('Logo'));                       // circles become the logo
    let zoom = lerp(1.85, 1.7, logoT);                          // ease back out for the lockup
    zoom = lerp(zoom, 0.85, MOTION.io(cur('ZoomOut')));         // pull back to the wide framing
    zoom = lerp(zoom, 0.8, MOTION.io(MOTION.ramp(cur('Hold'), 0, 0.75))); // same pull-back, then last 1s holds the frame
    const wordT = MOTION.io(cur('Word'));                       // pan right + wordmark slides out
    const slide = lerp(-1150, 0, wordT);
    const cx = lerp(RC.x, 949.8, wordT);
    const fillOp = MOTION.ramp(cur('Logo'), 0, 0.12);           // circles ease on at the start
    const settle = logoT;                                       // 90% -> full opacity as the logo forms
    return { spin, zoom, fillOp, settle, logoT, wordT, slide, cx, cy: RC.y };
  }

  // Circle ring: colored at -90/30/150, whites between (logo order).
  const ANGLES = [
    { a: 150, fill: CLR.orange, white: false },
    { a: 30, fill: CLR.blue, white: false },
    { a: -90, fill: CLR.green, white: false },
    { a: 90, fill: '#FFFFFF', white: true },
    { a: -30, fill: '#FFFFFF', white: true },
    { a: 210, fill: '#FFFFFF', white: true },
  ];

  const AppCtx = React.createContext({ bg: '#1B232A' });

  function World({ name, p }) {
    const s = stageState(name, p);
    const dotR = lerp(RING_R, 70, s.logoT);
    const ringR = lerp(RING_DIST, 70, s.logoT);
    const whiteAlpha = lerp(1, 0.6, s.logoT);
    const camT = `translate(${779 - s.cx * s.zoom} ${309.5 - s.cy * s.zoom}) scale(${s.zoom})`;
    return (
      <svg viewBox="0 0 1558 619" width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, display: 'block' }} data-screen-label={name}>
        <defs>
          <clipPath id="lbxWordClip"><rect x="545" y="-500" width="3000" height="2000"></rect></clipPath>
        </defs>
        <g transform={camT}>
          {s.wordT > 0.001 && window.LBX_WORD_D && (
            <g clipPath="url(#lbxWordClip)">
              <g transform={`translate(${(-67.9 + s.slide).toFixed(1)} -102) scale(1.115)`}>
                <path d={window.LBX_WORD_D} fill="#FFFFFF"></path>
              </g>
            </g>
          )}
          <g transform={`translate(${RC.x} ${RC.y})`}>
            {s.fillOp > 0.001 && (
              <g transform={`rotate(${s.spin})`}>
                {ANGLES.map((c, i) => {
                  const op = s.fillOp * lerp(c.white ? 0.8 : 0.9, c.white ? whiteAlpha : 1, s.settle);
                  if (op < 0.001) return null;
                  const rad = (c.a * Math.PI) / 180;
                  const x = ringR * Math.cos(rad), y = ringR * Math.sin(rad);
                  return <circle key={i} cx={x} cy={y} r={dotR}
                    fill={c.fill} fillOpacity={op}></circle>;
                })}
              </g>
            )}
          </g>
        </g>
      </svg>
    );
  }

  const mk = (name) => function Scene(props) { return <World name={name} p={props.progress} />; };
  const SCENE_MAP = { Logo: mk('Logo'), ZoomOut: mk('ZoomOut'), Word: mk('Word'), Hold: mk('Hold') };

  function LogoReelVideo() {
    const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
    return (
      <AppCtx.Provider value={t}>
        <div style={{ width: '100%', height: '100vh', minHeight: 420, background: '#0E1216' }}>
          <SceneStage width={1558} height={619} scenes={window.OM_SCENES}
            playback={window.OM_PLAYBACK} bg={t.bg}>
            {SCENE_MAP}
          </SceneStage>
        </div>
        <TweaksPanel>
          <TweakSection label="Video" />
          <TweakColor label="Background" value={t.bg}
            options={['#1B232A', '#14181C', '#0B0E11']}
            onChange={(v) => setTweak('bg', v)} />
          <TweakSection label="Editing" />
          <TweakToggle label="Motion editor" value={t.motionEditor}
            onChange={(v) => setTweak('motionEditor', v)} />
        </TweaksPanel>
      </AppCtx.Provider>
    );
  }
  window.LogoReelVideo = LogoReelVideo;
})();
