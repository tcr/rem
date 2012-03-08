# REM, remedial rest interfaces

Goal: a cross-platform library which uses a manifest of known APIs to
make a simple, consistent interface to various REST interfaces. Chasing the
"ideal" RESTful web, with hypertext as the engine of application state.

## Run tests

Run any example in the examples floor.

    coffee examples/youtube

## Misc. Goals

* Abstract the host, i.e. `api.tumblr.com/v2` is be initialized `new REM('tumblr', 2)`
* Normalize rate limit/remaining option for APIs where it is available; throw consistent
  rate limit exceeded error
* Normalize OAuth/API key/authentication mechanisms
* Give each API a top-level reference (at `/`) to navigate available API calls, where
  one doesn't exist
* Have a JSON-defined schema listing each API's differences, making it cross-platform
