[PROJECT]|name=pytorch-mastery|type=local-leetcode-style-practice-platform|purpose=PyTorch-fundamentals-curriculum(4weeks,21problems)

[STACK]|frontend=Next.js-16(AppRouter)+TypeScript-strict+Tailwind-v4+shadcn/ui|editor=@monaco-editor/react(Python,dark)|markdown=react-markdown+remark-math+rehype-katex(LaTeX)|icons=lucide-react
|backend=FastAPI+Pydantic-v2+Uvicorn|execution=subprocess(tempfile-harness+uv-run-python)|problems=YAML-definitions|container=Docker-compose(optional)

[STRUCTURE]
|backend/|routers=problems.py(list/get)+execute.py(run/submit)|execution=runner.py(harness-builder+_eval_expected)|services=problem_loader.py(YAML-iterate-by-id)|problems/*.yml=21-curriculum-problems
|frontend/|app/page.tsx=dashboard(week-groups+sequential-unlock)|app/problem/[id]/page.tsx=solver(resizable-panes+Monaco+test-panel)|lib/api.ts(fetch-wrappers),types.ts,progress.ts(localStorage)|components/ProblemDescription.tsx(markdown-renderer)

[DEV]|backend-start=(cd-backend&&uv-run-uvicorn-app.main:app--port8000--reload)|frontend-start=(cd-frontend&&npm-run-dev)|frontend-build=(cd-frontend&&npm-run-build)|tsc-check=(cd-frontend&&./node_modules/.bin/tsc--noEmit)
|backend-port=8000|frontend-port=3000|api-url-client=http://localhost:8000|api-url-server=http://backend:8000(Docker-only)
|CRITICAL:Docker-on-port-8000-blocks-local-backend-always-check-`docker-ps`before-debugging-backend-changes

[EXECUTION-MODEL]|flow=POST-/execute/{mode}->load-YAML->build-harness->subprocess->parse-JSON-stdout|harness=injects-user-code+evaluates-inputs-in-shared-scope+calls-function+compares-output
|_eval_expected=handles-multi-line-via-exec(finds-last-tensor)+single-line-via-eval|input-scope=_globals.update(inputs)so-expected-can-reference-input-variables
|validation-types=allclose(value/tensor-rtol/atol)|equality(exact)|match_tensor(shape/dtype/device+optional-value)|length(len-check)
|timeouts=10s|python-cmd=`uv-run-python`(never-system-python)|SAFE_GLOBALS={torch:torch}

[PROBLEM-YAML]|schema=id|title|week|day|difficulty|focus|description(markdown/LaTeX)|starter_code|function_name|test_cases{visible[],hidden[]}|validation{type,rtol,atol}
|expected-formats=value-string(eval-able)|shape+dtype+device(match_tensor)|length(number)|CRITICAL:expected-expressions-should-reference-input-variables-not-recreate-them

[FRONTEND-PATTERNS]|state=React-useState+useEffect(no-global-store)|progress=localStorage-key=pytorch-mastery-progress|unlock=strict-sequential(prev-must-be-completed)|layout=h-screen-flex-col(header+flex-1-main)
|resizers=horizontal(left/description-vs-right/editor)+vertical(editor-vs-bottom-panel)|mouse-handlers=window-listener-pattern(cursor/userSelect-body-toggle)
|monaco=dynamic-import-ssr-false|theme=vs-dark|options=minimap-false,fontSize-14,automaticLayout-true

[UI-COMPONENTS]|header=problem-title+week/day+badge+completed-check+Run/Submit-buttons|left-pane=description(prose-invert)+examples(cards-with-input/expected)|right-pane=Monaco-editor+resizer+bottom-panel
|bottom-panel=tabs(Testcase=visible-inputs,Test-Result=pass/fail-cards)|ResultCard=green/red-badge+error-block+expected-vs-actual-diff
|dashboard=week-sections+problem-cards+difficulty-badges+lock-icon|locked=opacity-60+cursor-not-allowed,no-click

[TESTING]|backend=manual-curl-against-/-problems/-execute|frontend=manual-browser-verification|no-automated-test-suite-MVP
|common-bugs=Docker-port-conflict,stale-__pycache__,eval-scope-mismatch,missing-expected-value-in-allclose

[DOCKER]|compose=docker-compose.yml(frontend+backend)|use-case=one-command-deployment|dev-preference=run-separately(no-compose-overhead)
|MPS-note=Docker-Desktop-macOS-does-NOT-expose-MPS,backend-uses-CPU-PyTorch-in-container

[AGENTS.md]=frontend/CLAUDE.md(points-here)
