<!-- pageskim 0.1 -->
# Configuration Reference | gridctl Documentation

> Complete configuration reference for gridctl, the command-line scheduler for batch compute grids: file format, all options, environment variables and examples.

type: docs
url: https://docs.gridctl.example.com/reference/configuration
lang: en
hash: sha256:f9ee2f1962d37dca

## toc
- intro
- file-location
- minimal-example
- cluster-options
- defaults-options
- environment-variables
- validation
- logging-options
- secrets
- troubleshooting
- migrating-from-v1

## facts
@table cluster-options
cols: option|type|default|description
`endpoint`|string|—|Host:port of the grid API server. Required.
`tls`|bool|`true`|Use TLS for all API connections.
`ca_bundle`|path|system store|PEM bundle used to verify the server certificate.
`connect_timeout_ms`|int|`5000`|TCP connect timeout in milliseconds.
`keepalive_s`|int|`30`|gRPC keepalive interval in seconds. 0 disables.
@end
@table defaults-options
cols: option|type|default|description
`queue`|string|`"default"`|Queue used when a job spec omits one.
`max_retries`|int|`0`|Automatic retries for jobs that exit non-zero.
`priority`|int|`100`|Job priority, 0–1000. Higher schedules earlier.
`output_dir`|path|`"./grid-out"`|Where job stdout/stderr bundles are written.
`notify`|string|`"never"`|One of `never`, `on-failure`, `always`.
@end
@table logging-options
cols: option|type|default|description
`level`|string|`"info"`|One of `error`, `warn`, `info`, `debug`, `trace`.
`format`|string|`"text"`|`text` for humans, `json` for pipelines.
`file`|path|stderr|Append logs to a file instead of stderr.
`redact_env`|bool|`true`|Replace values of env vars matching `*_TOKEN`, `*_SECRET`, `*_KEY` with `[redacted]` in debug output.
@end

## chunk intro
summary: gridctl reads its configuration from a single TOML file.
anchor: #configuration-reference

gridctl reads its configuration from a single TOML file. This page documents every option, the resolution order, and the environment variables that override the file. Configuration applies to the client; per-job settings belong in the job spec instead.

## chunk file-location
summary: gridctl looks for configuration in the following order, using the first file it finds.
anchor: #file-location

gridctl looks for configuration in the following order, using the first file it finds. Later sources never merge into earlier ones; resolution stops at the first match.

- Path given with `--config <path>`
- `$GRIDCTL_CONFIG` if set
- `./gridctl.toml` in the working directory
- `$XDG_CONFIG_HOME/gridctl/config.toml` (defaults to `~/.config/gridctl/config.toml` )

Note: if no file is found, gridctl runs with built-in defaults and prints a one-line notice to stderr. Use `gridctl config show --effective` to see the merged result of defaults, file and environment.

## chunk minimal-example
summary: A working configuration needs only the cluster endpoint and a default queue:
anchor: #minimal-example

A working configuration needs only the cluster endpoint and a default queue:

```
# gridctl.toml
[cluster]
endpoint = "grid.internal.example.com:7443"
tls = true

[defaults]
queue = "standard"
max_retries = 2
```

## chunk cluster-options
summary: See table: cluster-options
anchor: #cluster-options

table: cluster-options

## chunk defaults-options
summary: See table: defaults-options
anchor: #defaults-options

table: defaults-options

## chunk environment-variables
summary: Every option can be overridden with an environment variable named `GRIDCTL_<SECTION>_<OPTION>`, uppercased.
anchor: #environment-variables

Every option can be overridden with an environment variable named `GRIDCTL_<SECTION>_<OPTION>`, uppercased. Environment variables take precedence over the file but not over command-line flags.

```
export GRIDCTL_CLUSTER_ENDPOINT="staging.grid.example.com:7443"
export GRIDCTL_DEFAULTS_QUEUE="preemptible"
gridctl submit train.job          # uses staging + preemptible
gridctl submit train.job --queue=standard   # flag wins
```

## chunk validation
summary: Run `gridctl config validate` to check a file without contacting the cluster.
anchor: #validation

Run `gridctl config validate` to check a file without contacting the cluster. Unknown keys are errors, not warnings, to catch typos like `max_retrys`. The command exits 0 on success, 2 on validation failure, matching the global exit-code table.

```
$ gridctl config validate --config ./gridctl.toml
gridctl.toml:14: unknown key "max_retrys" in [defaults] (did you mean "max_retries"?)
```

## chunk logging-options
summary: Client-side logging is written to stderr by default and never contains job payloads.
anchor: #logging-options

Client-side logging is written to stderr by default and never contains job payloads. Structured output is available for shipping into a log pipeline.

table: logging-options

## chunk secrets
summary: gridctl never stores credentials in its configuration file.
anchor: #secrets

gridctl never stores credentials in its configuration file. The API token is read from `$GRIDCTL_TOKEN`, from the system keychain when `gridctl login` has been run, or from a credentials helper named in `[cluster].credential_helper`. If more than one source is available the order is: explicit environment variable, credential helper, keychain. A missing token produces exit code 3 with a pointer to `gridctl login`; it is never prompted for interactively in non-TTY contexts, which keeps CI failures loud and fast.

## chunk troubleshooting
summary: The three most common configuration problems, in the order support sees them: a stale `endpoint` after a cluster migration (symptom: `connect timeout` after…
anchor: #troubleshooting

The three most common configuration problems, in the order support sees them: a stale `endpoint` after a cluster migration (symptom: `connect timeout` after exactly `connect_timeout_ms`; fix: update `[cluster].endpoint`); TLS verification failures against clusters using a private CA (symptom: `x509: certificate signed by unknown authority`; fix: set `ca_bundle`, do not disable `tls`); and environment overrides leaking from a forgotten shell profile (symptom: flags appear ignored; fix: run `gridctl config show --effective --origins`, which annotates every value with the source that set it).

## chunk migrating-from-v1
summary: Version 2 renamed the `[server]` section to `[cluster]` and moved retry settings from `[retry]` into `[defaults]`.
anchor: #migrating-from-v1

Version 2 renamed the `[server]` section to `[cluster]` and moved retry settings from `[retry]` into `[defaults]`. Run `gridctl config migrate` to rewrite a v1 file in place; a backup is written alongside with a `.v1.bak` suffix. The v1 format is read-only supported until gridctl 2.4 and removed in 2.5.
