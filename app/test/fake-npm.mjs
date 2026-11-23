// A stand-in for npm in tests (AI_WORKSPACE_NPM): `npm run typecheck` and `npm test` pass, unless
// AI_WORKSPACE_FAKE_NPM_FAIL names the script, which then fails with a line of output.
const [cmd, script] = process.argv.slice(2);
const name = cmd === 'run' ? script : cmd;
if (process.env.AI_WORKSPACE_FAKE_NPM_FAIL === name) { console.error(`error in ${name}: src/a.ts(1,1) broken`); process.exit(1); }
console.log(name === 'test' ? 'ℹ tests 5\nℹ pass 5\nℹ fail 0' : '> tsc');
