# prepare-pr

Please prepare this work for a pull request by completing all necessary checks first. Once the checks are complete, take steps to maintain the repository hygiene. Finally, move on to preparing the PR.

## Necessary checks

- update the supabase types (npm run generate:suapbase types)
- ensure the test suite passes. If it does not, inspect the output of the test run, update the code. Repeat until the tests pass
- ensure the type check passes (npm run type-check). If it does not, inspect the output of the check and update the code. Repeat until the check passes

## Maintain repo hygiene

- based on the changes made, update the relevant documentation in the codebase
- if there are any env variables in .env.local that aren't in env.example, update env example with the new env var names and dummy values

## Prepare the PR

- commit all changes. use multiple commits if necessary
- draft a pull request description and return this as a markdown snippet. DO NOT write this to a file
- ensure we are on a suitably named branch (prefixed with feat/* or fix/* or docs/*)
- push the branch to remote - return the link to create a new PR at the bottom of your output
