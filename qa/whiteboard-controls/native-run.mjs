// Extend the existing scene suite without installing a plugin version.
process.env.QA_IN_MEMORY='1';
process.env.QA_EXTENDED??='1';
if(!process.env.QA_FIXTURE_DIR)throw Error('Set QA_FIXTURE_DIR to a directory containing synthetic fixture.png, fixture.wav and fixture.mp4; see README.');
await import('../ordinary-board-ui-1332/native-run.mjs');
