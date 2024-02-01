console.log('rainbows.test.js')

const { describe } = require("riteway")
const { eos, names, getTableRows, isLocal, sleep, initContracts,
        httpEndpoint, getBalance, getBalanceFloat, asset } = require("../scripts/helper")
const { addActorPermission } = require("../scripts/deploy")
const { equals } = require("ramda")
const fetch = require("node-fetch");
const { escrow, accounts, token, firstuser, seconduser, thirduser, pool, fourthuser,
        fifthuser, settings, rainbows, owner } = names
const moment = require('moment')

const get_scope = async ( code ) => {
  const url = httpEndpoint + '/v1/chain/get_table_by_scope'
  const params = {
    json: "true",
    limit: 20,
    code: code
  }
  const rawResponse = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
  });

  const res = await rawResponse.json();
  return res
}

const get_supply = async( code, symbol ) => {
  const resp = await getTableRows({
    code: code,
    scope: symbol,
    table: 'stat',
    json: true
  })
  const res = await resp;
  return res.rows[0].supply;
}

describe('rainbows', async assert => {

    if (!isLocal()) {
        console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
        return
    }

  console.log('installed at '+rainbows)
  const contracts = await Promise.all([
    eos.contract(rainbows),
    eos.contract(token)
  ]).then(([rainbows, token]) => ({
    rainbows, token
  }))

  const setSeedsBalance = async( account, balance) => {
    console.log(`setting ${account} to ${balance}`)
    let bal = await eos.getCurrencyBalance(token, account, 'SEEDS')
    console.log(`bal ${account} ${bal[0]} ${bal[1]}`)
    if( bal[0] != balance ) {
      await contracts.token.transfer(account, owner, bal[0], '', { authorization: `${account}@active` } )
      if( parseFloat(balance) != 0.0 ) {
        await contracts.token.transfer(owner, account, balance, '', { authorization: `${owner}@active` } )
      }
    }
  }

  const issuer = firstuser
  const toke_escrow = seconduser
  const withdraw_to = thirduser

  const starttime = new Date()

  console.log('--Normal operations--')

  console.log('add eosio.code permissions')
  await addActorPermission(issuer, 'active', rainbows, 'eosio.code')
  await addActorPermission(toke_escrow, 'active', rainbows, 'eosio.code')

  console.log('reset')
  await contracts.rainbows.reset(true, 100, { authorization: `${rainbows}@active` })

  const accts = [ firstuser, seconduser, thirduser, fourthuser, fifthuser ]
  for( const acct of accts ) {
    await contracts.rainbows.resetacct( acct, { authorization: `${rainbows}@active` })
  }  

  assert({
    given: 'reset all',
    should: 'clear table RAM',
    actual: await get_scope(rainbows),
    expected: { rows: [], more: '' }
  })

  await setSeedsBalance(issuer, '10000000.0000 SEEDS')
  await setSeedsBalance(seconduser, '10000000.0000 SEEDS')
  await setSeedsBalance(thirduser, '5000000.0000 SEEDS')
  await setSeedsBalance(fourthuser, '10000000.0000 SEEDS')
  const issuerInitialBalance = await getBalance(issuer)

  console.log('create token')
  await contracts.rainbows.create(issuer, '1000000.00 TOKES', issuer, withdraw_to, issuer,
                         starttime.toISOString(), starttime.toISOString(), '', '', '', '',
                          { authorization: `${issuer}@active` } )

  console.log('set backing')
  await contracts.rainbows.setbacking('5.00 TOKES', '2.0000 SEEDS', 'token.seeds', toke_escrow, false, 100, '',
                          { authorization: `${issuer}@active` } )

  console.log('approve token')
  await contracts.rainbows.approve('TOKES', false, { authorization: `${rainbows}@active` })

  console.log('issue tokens')
  await contracts.rainbows.issue('500.00 TOKES', '', { authorization: `${issuer}@active` })

  assert({
    given: 'create & issue token',
    should: 'see token created & issued',
    actual: await get_scope(rainbows),
    expected: {
      rows: [ {"code":"rainbo.seeds","scope":".....ou5dhbp4","table":"backings","payer":"seedsuseraaa","count":2},
{"code":"rainbo.seeds","scope":".....ou5dhbp4","table":"configs","payer":"seedsuseraaa","count":1},
              {"code":"rainbo.seeds","scope":".....ou5dhbp4","table":"displays","payer":"seedsuseraaa","count":1},
              {"code":"rainbo.seeds","scope":".....ou5dhbp4","table":"stat","payer":"seedsuseraaa","count":1},
              {"code":"rainbo.seeds","scope":"rainbo.seeds","table":"symbols","payer":"seedsuseraaa","count":1},
              {"code":"rainbo.seeds","scope":"seedsuseraaa","table":"accounts","payer":"seedsuseraaa","count":1} ],
      more: '' }
  })

  console.log('open accounts')
  await contracts.rainbows.open(fourthuser, 'TOKES', issuer, { authorization: `${issuer}@active` })
  await contracts.rainbows.open(withdraw_to, 'TOKES', issuer, { authorization: `${issuer}@active` })

  console.log('transfer tokens')
  await contracts.rainbows.transfer(issuer, fourthuser, '100.00 TOKES', 'test 1', { authorization: `${issuer}@active` })

  console.log('withdraw tokens')
  await contracts.rainbows.transfer(fourthuser, withdraw_to, '80.00 TOKES', 'withdraw', { authorization: `${issuer}@active` })

  assert({
    given: 'transfer token to new user',
    should: 'see tokens in users account, correct supply',
    actual: [ await eos.getCurrencyBalance(token, toke_escrow, 'SEEDS'),
              await eos.getCurrencyBalance(rainbows, fourthuser, 'TOKES'),
              await get_supply(rainbows, 'TOKES'),
            ],
    expected: [ [ '10000200.0000 SEEDS' ], [ '20.00 TOKES' ], '500.00 TOKES' ]
  })

  console.log('redeem & return')
  await contracts.rainbows.retire(fourthuser, '20.00 TOKES', true, 'redeemed by user', { authorization: `${fourthuser}@active` })  
  await contracts.rainbows.retire(withdraw_to, '80.00 TOKES', true, 'redeemed by user', { authorization: `${withdraw_to}@active` })  
  await contracts.rainbows.retire(issuer, '400.00 TOKES', true, 'redeemed by issuer', { authorization: `${issuer}@active` })  
  await contracts.token.transfer(fourthuser, issuer, '8.0000 SEEDS', 'restore SEEDS balance',
                       { authorization: `${fourthuser}@active` })
  await contracts.token.transfer(withdraw_to, issuer, '32.0000 SEEDS', 'restore SEEDS balance',
                       { authorization: `${withdraw_to}@active` })

  assert({
    given: 'redeem & return',
    should: 'see original seeds quantity in issuer account',
    actual: await getBalance(issuer),
    expected: issuerInitialBalance
  })

  console.log('delete backing')
  await contracts.rainbows.deletebacking(0, 'TOKES', '', { authorization: `${issuer}@active` })
  assert({
    given: 'delete backing',
    should: 'see backing entry gone',
    actual: (await getTableRows({
      code: rainbows,
      scope: 'TOKES',
      table: 'backings',
      json: true
    }))['rows'],
    expected: []
  })

  console.log('garner tokens')
  await contracts.rainbows.garner(fourthuser, withdraw_to, 'TOKES', 10000, 'garner 1%', { authorization: `${issuer}@active` })

  assert({
    given: 'garner tokens using withdraw power',
    should: 'see tokens in users account',
    actual: [ await eos.getCurrencyBalance(rainbows, fourthuser, 'TOKES'),
              await eos.getCurrencyBalance(rainbows, withdraw_to, 'TOKES'),
            ],
    expected: [ [ '19.80 TOKES' ], [ '0.20 TOKES' ] ]
  })

  console.log('create credit limit token')
  await contracts.rainbows.create(issuer, '1000000.00 CREDS', issuer, issuer, issuer,
                         starttime.toISOString(), starttime.toISOString(), '', '', '', '',
                          { authorization: `${issuer}@active` } )
  await contracts.rainbows.approve('CREDS', false, { authorization: `${rainbows}@active` })
  await contracts.rainbows.issue('1000000.00 CREDS', '', { authorization: `${issuer}@active` })
  await contracts.rainbows.freeze('CREDS', true, '', { authorization: `${issuer}@active` })
  await contracts.rainbows.open(fourthuser, 'CREDS', issuer, { authorization: `${issuer}@active` })
  await contracts.rainbows.transfer(issuer, fourthuser, '50.00 CREDS', '', { authorization: `${issuer}@active` })
  await contracts.rainbows.transfer(issuer, fifthuser, '100.00 CREDS', '', { authorization: `${issuer}@active` })

  console.log('reconfigure token')
  await contracts.rainbows.create(issuer, '100.00 TOKES', issuer, withdraw_to, issuer,
                         starttime.toISOString(), starttime.toISOString(), '', '', 'CREDS', '',
                          { authorization: `${issuer}@active` } )
  console.log('make transfers against credit limit')
  await contracts.rainbows.transfer(fourthuser, issuer, '50.00 TOKES', '', { authorization: `${fourthuser}@active` })
  await contracts.rainbows.transfer(fifthuser, issuer, '50.00 TOKES', '', { authorization: `${fifthuser}@active` })

  assert({
    given: 'transfer tokens',
    should: 'see negative currency balance',
    actual: [ await eos.getCurrencyBalance(rainbows, fourthuser, 'TOKES'),
              await get_supply(rainbows, 'TOKES') ],
    expected: [ [ '-50.00 TOKES' ], '100.00 TOKES' ]
  })

  console.log('return some TOKES')
  await contracts.rainbows.transfer(fifthuser, fourthuser, '20.00 TOKES', '', { authorization: `${fifthuser}@active` })
  await contracts.rainbows.transfer(issuer, fourthuser, '20.00 TOKES', '', { authorization: `${issuer}@active` })
  assert({
    given: 'transfer tokens back',
    should: 'see expected currency balance and supply',
    actual: [ await eos.getCurrencyBalance(rainbows, fourthuser, 'TOKES'),
              await eos.getCurrencyBalance(rainbows, fifthuser, 'TOKES'),
              await get_supply(rainbows, 'TOKES') ],
    expected: [ [ '-10.00 TOKES' ], [ '-70.00 TOKES' ], '80.00 TOKES' ]
  })

  console.log('overdraw credits')
  let actionProperlyBlocked = true
  try {
    await contracts.rainbows.transfer(fourthuser, fifthuser, '41.00 TOKES', '', { authorization: `${fourthuser}@active` })
    actionProperlyBlocked = false
  } catch (err) {
    actionProperlyBlocked &&= err.toString().includes('overdrawn balance')
    console.log( (actionProperlyBlocked ? "" : "un") + "expected error "+err)
  }
  try {
    await contracts.rainbows.transfer(fourthuser, issuer, '21.00 TOKES', '', { authorization: `${fourthuser}@active` })
    actionProperlyBlocked = false
  } catch (err) {
    actionProperlyBlocked &&= err.toString().includes('new credit exceeds available supply')
    console.log( (actionProperlyBlocked ? "" : "un") + "expected error "+err)
  }
  assert({
    given: 'trying use too much credit',
    should: 'fail',
    actual: actionProperlyBlocked,
    expected: true
  })

  console.log('reset CREDS')
  let bal = await eos.getCurrencyBalance(rainbows, fourthuser, 'CREDS')
  if( bal[0] != '0.00 CREDS' ) {
    await contracts.rainbows.transfer(fourthuser, issuer, bal[0], 'withdraw CREDS', { authorization: `${issuer}@active` } )
  }
  bal = await eos.getCurrencyBalance(rainbows, fifthuser, 'CREDS')
  if( bal[0] != '0.00 CREDS' ) {
    await contracts.rainbows.transfer(fifthuser, issuer, bal[0], 'withdraw CREDS', { authorization: `${issuer}@active` } )
  }


  console.log('create proportional backed token')

  await contracts.rainbows.create(issuer, '1000000.0000 PROPS', issuer, withdraw_to, issuer,
                         starttime.toISOString(), starttime.toISOString(), '', '', '', '',
                          { authorization: `${issuer}@active` } )
  await setSeedsBalance(fourthuser, '10000000.0000 SEEDS')


  console.log('empty PROPS escrow account')
  await setSeedsBalance(fifthuser, '0.0000 SEEDS')


  console.log('set backing')
  await contracts.rainbows.setbacking('1.0000 PROPS', '2.0000 SEEDS', 'token.seeds', fifthuser, true, 100, '',
                          { authorization: `${issuer}@active` } )
  await addActorPermission(fifthuser, 'active', rainbows, 'eosio.code')

  console.log('approve token')
  await contracts.rainbows.approve('PROPS', false, { authorization: `${rainbows}@active` })

  console.log('issue tokens')
  await contracts.rainbows.issue('500.0000 PROPS', '', { authorization: `${issuer}@active` })

  assert({
    given: 'create & issue token',
    should: 'see token created & issued',
    actual: await get_scope(rainbows),
    expected: {
      rows: [ { code: 'rainbo.seeds', scope: '.....ou4cpd43', table: 'configs', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: '.....ou4cpd43', table: 'displays', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: '.....ou4cpd43', table: 'stat', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: '.....ou5dhbp4', table: 'configs', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: '.....ou5dhbp4', table: 'displays', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: '.....ou5dhbp4', table: 'stat', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: '.....oukdxd5', table: 'backings', payer: 'seedsuseraaa', count: 2 },
              { code: 'rainbo.seeds', scope: '.....oukdxd5', table: 'configs', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: '.....oukdxd5', table: 'displays', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: '.....oukdxd5', table: 'stat', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: 'rainbo.seeds', table: 'symbols', payer: 'seedsuseraaa', count: 3 },
              { code: 'rainbo.seeds', scope: 'seedsuseraaa', table: 'accounts', payer: 'seedsuseraaa', count: 3 },
              { code: 'rainbo.seeds', scope: 'seedsuserccc', table: 'accounts', payer: 'seedsuseraaa', count: 1 },
              { code: 'rainbo.seeds', scope: 'seedsuserxxx', table: 'accounts', payer: 'seedsuseraaa', count: 2 },
              { code: 'rainbo.seeds', scope: 'seedsuseryyy', table: 'accounts', payer: 'seedsuseraaa', count: 2 }
            ],
      more: '' }
  })

  console.log('transfer tokens')
  await contracts.rainbows.transfer(issuer, fourthuser, '100.0000 PROPS', 'test nonmember', { authorization: `${issuer}@active` })

  console.log('redeem some')
  await contracts.rainbows.retire(fourthuser, '20.0000 PROPS', true, 'redeemed by user', { authorization: `${fourthuser}@active` })  
  

  assert({
    given: 'transfer tokens',
    should: 'see correct quantity',
    actual: [ await eos.getCurrencyBalance(rainbows, fourthuser, 'PROPS'),
              await eos.getCurrencyBalance(token, fourthuser, 'SEEDS') ],
    expected: [ [ '80.0000 PROPS' ], [ '10000040.0000 SEEDS' ] ]
  })

  console.log('increase escrow balance by 50%')
  await contracts.token.transfer(issuer, fifthuser, '480.0000 SEEDS', '+50% escrow', { authorization: `${issuer}@active` })

  console.log('redeem some more')
  await contracts.rainbows.retire(fourthuser, '20.0000 PROPS', true, 'redeemed by user', { authorization: `${fourthuser}@active` })  

  assert({
    given: 'proportional reedeem',
    should: 'see tokens redeemed at +50% rate',
    actual: [ await eos.getCurrencyBalance(rainbows, fourthuser, 'PROPS'),
              await eos.getCurrencyBalance(token, fourthuser, 'SEEDS') ],
    expected: [ [ '60.0000 PROPS' ], [ '10000100.0000 SEEDS' ] ]
  })

  console.log('redeem & return')
  await contracts.rainbows.retire(fourthuser, '60.0000 PROPS', true, 'redeemed by user', { authorization: `${fourthuser}@active` })  
  await contracts.rainbows.retire(issuer, '400.0000 PROPS', true, 'redeemed by issuer', { authorization: `${issuer}@active` })  
  await contracts.token.transfer(fourthuser, issuer, '280.0000 SEEDS', 'restore SEEDS balance',
                       { authorization: `${fourthuser}@active` })

  assert({
    given: 'redeem & return',
    should: 'see original seeds quantity in issuer account',
    actual: await getBalance(issuer),
    expected: issuerInitialBalance
  })

  console.log('---begin error condition checks---')

  console.log('reset')
  await contracts.rainbows.reset(true, 100, { authorization: `${rainbows}@active` })

  for( const acct of accts ) {
    await contracts.rainbows.resetacct( acct, { authorization: `${rainbows}@active` })
  }  

  assert({
    given: 'reset all',
    should: 'clear table RAM',
    actual: await get_scope(rainbows),
    expected: { rows: [], more: '' }
  })

  console.log('create token')
  await contracts.rainbows.create(issuer, '1000000.00 TOKES', issuer, withdraw_to, issuer,
                         starttime.toISOString(), starttime.toISOString(), '', '', '', '',
                          { authorization: `${issuer}@active` } )

  console.log('issue tokens without approval')
  actionProperlyBlocked = true
  try {
    await contracts.rainbows.issue('500.00 TOKES', '', { authorization: `${issuer}@active` })
    actionProperlyBlocked = false
  } catch (err) {
    actionProperlyBlocked &&= err.toString().includes('cannot issue until token is approved')
    console.log( (actionProperlyBlocked ? "" : "un") + "expected error "+err)
  }
  assert({
    given: 'trying to issue tokens without approval',
    should: 'fail',
    actual: actionProperlyBlocked,
    expected: true
  })

  console.log('create membership token with erroneous decimals')
  await contracts.rainbows.create(issuer, '1000.00 MEMBERS', issuer, issuer, issuer,
                         starttime.toISOString(), starttime.toISOString(), '', '', '', '',
                          { authorization: `${issuer}@active` } )
  await contracts.rainbows.approve('MEMBERS', false, { authorization: `${rainbows}@active` })
  await contracts.rainbows.freeze('MEMBERS', true, '', { authorization: `${issuer}@active` })

  console.log('update token with member token errors')
  actionProperlyBlocked = true
  try {
  await contracts.rainbows.create(issuer, '1000000.00 TOKES', issuer, withdraw_to, issuer,
                         starttime.toISOString(), starttime.toISOString(), 'MEMBERS', '', '', '',
                          { authorization: `${issuer}@active` } )
    actionProperlyBlocked = false
  } catch (err) {
    actionProperlyBlocked &&= err.toString().includes('MEMBERS token precision must be 0')
    console.log( (actionProperlyBlocked ? "" : "un") + "expected error "+err)
  }
  try {
  await contracts.rainbows.create(issuer, '1000000.00 TOKES', issuer, withdraw_to, issuer,
                         starttime.toISOString(), starttime.toISOString(), 'BADNAME', '', '', '',
                          { authorization: `${issuer}@active` } )
    actionProperlyBlocked = false
  } catch (err) {
    actionProperlyBlocked &&= err.toString().includes('BADNAME token does not exist')
    console.log( (actionProperlyBlocked ? "" : "un") + "expected error "+err)
  }
  assert({
    given: 'trying to create token with bad membership',
    should: 'fail',
    actual: actionProperlyBlocked,
    expected: true
  })
 
  console.log('create good membership token')
  await contracts.rainbows.create(issuer, '1000 MEMBERS', issuer, issuer, issuer,
                         starttime.toISOString(), starttime.toISOString(), '', '', '', '',
                          { authorization: `${issuer}@active` } )
  await contracts.rainbows.approve('MEMBERS', false, { authorization: `${rainbows}@active` })
  await contracts.rainbows.freeze('MEMBERS', true, '', { authorization: `${issuer}@active` })
  await contracts.rainbows.issue('100 MEMBERS', '', { authorization: `${issuer}@active` })
  await contracts.rainbows.create(issuer, '1000000.00 TOKES', issuer, withdraw_to, issuer,
                         starttime.toISOString(), starttime.toISOString(), 'MEMBERS', '', '', '',
                          { authorization: `${issuer}@active` } )
  await contracts.rainbows.approve('TOKES', false, { authorization: `${rainbows}@active` })
  await contracts.rainbows.issue('1000.00 TOKES', '', { authorization: `${issuer}@active` })

  console.log('send tokens against membership rules')
  actionProperlyBlocked = true
  try {
    await contracts.rainbows.transfer(issuer, fourthuser, '100.00 TOKES', '', { authorization: `${issuer}@active` })
    actionProperlyBlocked = false
  } catch (err) {
    actionProperlyBlocked &&= err.toString().includes('to account must have membership')
    console.log( (actionProperlyBlocked ? "" : "un") + "expected error "+err)
  }
  try {
    await contracts.rainbows.transfer(issuer, fourthuser, '1 MEMBERS', '', { authorization: `${issuer}@active` })
    await contracts.rainbows.transfer(issuer, fifthuser, '1 MEMBERS', '', { authorization: `${issuer}@active` })
    await contracts.rainbows.transfer(issuer, fourthuser, '100.00 TOKES', '', { authorization: `${issuer}@active` })
    await contracts.rainbows.transfer(fourthuser, fifthuser, '100.00 TOKES', '', { authorization: `${fourthuser}@active` })
    actionProperlyBlocked = false
  } catch (err) {
    actionProperlyBlocked &&= err.toString().includes('cannot transfer visitor to visitor')
    console.log( (actionProperlyBlocked ? "" : "un") + "expected error "+err)
  }
  assert({
    given: 'trying to send tokens against membership rules',
    should: 'fail',
    actual: actionProperlyBlocked,
    expected: true
  })

  console.log('send tokens between visitor and member')
    await contracts.rainbows.transfer(issuer, fifthuser, '1 MEMBERS', '', { authorization: `${issuer}@active` })
    await contracts.rainbows.transfer(fourthuser, fifthuser, '100.00 TOKES', '', { authorization: `${fourthuser}@active` })
    await contracts.rainbows.transfer(fifthuser, fourthuser, '40.00 TOKES', '', { authorization: `${fifthuser}@active` })
  assert({
    given: 'valid transfers',
    should: 'see correct token balance in recipient account',
    actual: await eos.getCurrencyBalance(rainbows, fifthuser, 'TOKES'),
    expected: [ '60.00 TOKES' ]
  })

  console.log('create fractional backed token')

  await contracts.rainbows.create(issuer, '1000000.0000 FRACS', issuer, withdraw_to, issuer,
                         starttime.toISOString(), starttime.toISOString(), '', '', '', '',
                          { authorization: `${issuer}@active` } )
  await setSeedsBalance(fourthuser, '10000000.0000 SEEDS')


  console.log('empty FRACS escrow account')
  await setSeedsBalance(fifthuser, '0.0000 SEEDS')


  console.log('set backing')
  await contracts.rainbows.setbacking('1.0000 FRACS', '2.0000 SEEDS', 'token.seeds', fifthuser, false, 30, '',
                          { authorization: `${issuer}@active` } )
  await addActorPermission(fifthuser, 'active', rainbows, 'eosio.code')

  console.log('approve token')
  await contracts.rainbows.approve('FRACS', false, { authorization: `${rainbows}@active` })

  console.log('issue tokens')
  await contracts.rainbows.issue('500.0000 FRACS', '', { authorization: `${issuer}@active` })

  console.log('transfer tokens')
  await contracts.rainbows.transfer(issuer, fourthuser, '100.0000 FRACS', '', { authorization: `${issuer}@active` })
  await contracts.token.transfer(fifthuser, issuer, '500.0000 SEEDS', '', { authorization: `${fifthuser}@active` })

  console.log('redeem some')
  await contracts.rainbows.retire(fourthuser, '20.0000 FRACS', true, 'redeemed by user', { authorization: `${fourthuser}@active` })  
  

  assert({
    given: 'create & redeem with fractional reserve',
    should: 'see correct quantity',
    actual: [ await eos.getCurrencyBalance(rainbows, fourthuser, 'FRACS'),
              await eos.getCurrencyBalance(token, fourthuser, 'SEEDS'),
              await eos.getCurrencyBalance(token, fifthuser, 'SEEDS') ],
    expected: [ [ '80.0000 FRACS' ], [ '10000040.0000 SEEDS' ], [ '460.0000 SEEDS' ] ]
  })

  console.log('redeem with insufficient reserve')
  actionProperlyBlocked = true
  try {
    await contracts.token.transfer(fifthuser, issuer, '145.0000 SEEDS', '', { authorization: `${fifthuser}@active` })
    await contracts.rainbows.retire(fourthuser, '20.0000 FRACS', true, 'redeemed by user', { authorization: `${fourthuser}@active` })  
    actionProperlyBlocked = false
  } catch (err) {
    actionProperlyBlocked &&= err.toString().includes('can\'t redeem, escrow underfunded in SEEDS')
    console.log( (actionProperlyBlocked ? "" : "un") + "expected error "+err)
  }
  assert({
    given: 'trying to redeem with insufficient reserve',
    should: 'fail',
    actual: actionProperlyBlocked,
    expected: true
  })

})


