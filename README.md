# Intro

Localscale info at https://localscale.org/

This repo contains the Locascale version of the "Rainbow Token" smart contract, cloned from https://github.com/chuck-h/seeds-smart-contracts

This project originated as part of the SEEDS ecosystem https://joinseeds.earth/

## Status

This repo has just been ported over and is in the process of being cleaned up.

# Contract Names

See here: https://gitlab.com/seeds-project/seeds-contracts/issues/25

# Setup

### Git
```
git submodule init
git submodule update
```


### Environment

The .env file contains the all-important keys for local, testnet, and potentially mainnet

It also contains a compiler setting - use either local compiler or Docker based compiler

Copy the example to .env

```
cp .env.example .env
```

### Compiler Setup in .env file

The COMPILER variable can either be docker or local - if you have eos-cpp installed on your local machine you can use local, if you want to use a docker container make sure docker is running and it'll do everything for you.

Use COMPILER=local if using https://github.com/AntelopeIO/DUNES for local unit tests

### Tools Setup

```
npm install
```

### Start local test network with DUNES

```
get DUNES from https://github.com/AntelopeIO/DUNES and follow install process in README
upgrade nodejs https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
dune --start mynode
dune --bootstrap-system
dune --create-account owner eosio EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3
```

When using the `seeds.js` test script (see below) in the DUNES container, use this convention
```
dune -- /host`pwd`/scripts/seeds.js init
```
instead of
```
./scripts/seeds.js init
```

### Start single-node local test network (alternative without DUNES)

The local testnet is required for unit tests.

```
nodeos -e -p eosio --plugin eosio::producer_plugin --plugin eosio::producer_api_plugin --plugin eosio::chain_api_plugin --plugin eosio::state_history_plugin --disable-replay-opts --plugin eosio::http_plugin --access-control-allow-origin='*' --access-control-allow-headers "*" --contracts-console --http-validate-host=false --delete-all-blocks --delete-state-history --verbose-http-errors >> nodeos.log 2>&1
```

### Create local testnet owner account

This requires a wallet capable of signing the "create account" action, for example `cleos`.

```
cleos wallet create --to-console
cleos wallet import --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 # LOCAL_PRIVATE_KEY in .env file
cleos create account eosio owner EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV # Public key matching above
```

# Deploy Tools

Use the seeds.js script to 

### init all contracts and deploy them on local network

```
./scripts/seeds.js init
```

### update contract permissions

This command will update all permissions on all contracts

It will check if a permission is already set and only set permissions that
have been added or have been changed.

```
./scripts/seeds.js updatePermissions
```

### Compile, deploy, or test a contract

```
./scripts/seeds.js compile harvest => compiles seeds.harvest.cpp
```
```
./scripts/seeds.js deploy accounts => deploys accounts contract
```
```
./scripts/seeds.js test accounts => run unit tests on accounts contract
```
```
./scripts/seeds.js run accounts => compile, deploy, and run unit tests
```
### Specify more than one contract - 

Contract is a varadic parameter

```
./scripts/seeds.js run accounts onboarding organization
```

### Deploy on testnet
```
EOSIO_NETWORK=telosTestnet ./scripts/seeds.js deploy accounts
```
### Deploy on mainnet
```
EOSIO_NETWORK=telosMainnet ./scripts/seeds.js deploy accounts
```

### usage seeds.js 
```
./scripts/seeds.js <command> <contract name> [additional contract names...]
command = compile | deploy | test | run
```


### run a contract - compile, then deploy, then test 

```
example: 
./scripts/seeds.js run harvest => compiles seeds.harvest.cpp, deploys it, runs unit tests
```

### generate contract documentation

This command will generate html automatically based on the contract ABI files.

The <comment> tags inside the documents will be left untouched, even when they are regenerated.


This will generate docs only for the `accounts` contract.
```
./scripts/seeds.js docsgen accounts:
```

This will generate all contracts:
```
./scripts/seeds.js docsgen all
```

This will regenerate the index.html file:
```
./scripts/seeds.js docsgen index
```
