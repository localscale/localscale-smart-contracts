#include <seeds.tokensmaster.hpp>
#include <cstring>

void tokensmaster::reset() {
  require_auth(_self);

  usecase_table usecasetable(get_self(), get_self().value);
  for(auto itr = usecasetable.begin(); itr!=usecasetable.end(); ++itr) {  
    utils::delete_table<token_tables>(get_self(), itr->usecase.value);
  }
  utils::delete_table<usecase_table>(get_self(), get_self().value);
}

void tokensmaster::submittoken(name submitter, name usecase, string chain, name contract, symbol_code symbolcode, string json)
{
  require_auth(submitter);
  check(is_account(contract), "no contract account");
  check(symbolcode.is_valid(), "invalid symbol");
  check(json.size() <= MAXJSONLENGTH, "json string is > "+std::to_string(MAXJSONLENGTH));
  usecase_table usecasetable(get_self(), get_self().value);
  const auto& uc = usecasetable.get(usecase.value, "invalid use case");
  check(uc.allowed_chain == chain, "invalid chain");
  string signature = submitter.to_string()+usecase.to_string()+chain+contract.to_string()+symbolcode.to_string();
  token_tables tokentable(get_self(), usecase.value);
  auto token_signature_index = tokentable.get_index<"signature"_n>();
  check(token_signature_index.find(eosio::sha256( signature.c_str(), signature.length())) == token_signature_index.end(),
                                   "token already submitted");
  stats statstable( contract, symbolcode.raw() );
  const auto& st = statstable.get( symbolcode.raw(), ("no symbol "+symbolcode.to_string()+" in "+contract.to_string()).c_str());
  token_table tt;
  tt.submitter = submitter;
  tt.usecase = usecase;
  tt.contract = contract;
  tt.symbolcode = symbolcode;
  tt.approved = false;
  tt.chainName = chain;
  tt.json = json;

  string req = uc.required_fields;
  std::map<string,bool> field_list;
  size_t pos = 0;
  while (true) {
    (pos = req.find(' '));
    if (pos == string::npos) {
      field_list[req] = false;
      break;
    }
    if(pos != 0) {
      field_list[(req.substr(0, pos))] = false;
    }
    req.erase(0, pos + 1);
  }
  string rv = check_json_fields(field_list, json);
  check(rv.empty(), ("json error: "+rv).c_str());
  
  if(uc.unique_symbols) {
    auto token_symbol_index = tokentable.get_index<"symbolcode"_n>();
    check(token_symbol_index.find(symbolcode.raw()) == token_symbol_index.end(), "duplicate symbol");
  } 

  tokentable.emplace(submitter, [&]( auto& s ) {
    s = tt;
    s.id = tokentable.available_primary_key();
  });
}

void tokensmaster::approvetoken(name submitter, name usecase, string chain, name contract, symbol_code symbolcode, bool approve)
{
  usecase_table usecasetable(get_self(), get_self().value);
  const auto& uc = usecasetable.get(usecase.value, "usecase not found");
  require_auth(uc.manager);
  string signature = submitter.to_string()+usecase.to_string()+chain+contract.to_string()+symbolcode.to_string();
  token_tables tokentable(get_self(), usecase.value);
  auto token_signature_index = tokentable.get_index<"signature"_n>();
  const auto& tt = token_signature_index.get( eosio::sha256( signature.c_str(), signature.length()),
                                             "no matching row to approve" );
  if(approve) {
    auto token_symbol_index = tokentable.get_index<"symbolcode"_n>();
    auto itr = token_symbol_index.lower_bound(symbolcode.raw());
    while (itr != token_symbol_index.end() && itr->symbolcode == symbolcode) {
      check(itr->contract != contract || itr->usecase != usecase || itr->chainName != chain || !itr->approved, 
            "cannot overwrite existing token");
      ++itr;
    }
    tokentable.modify (tt, get_self(), [&]( auto& s ) {
      s.approved = true;
    });
  } else {
    tokentable.erase(tt);
  }
}

void tokensmaster::usecase(name usecase, name manager, bool add)
{
  require_auth(get_self());
  check(is_account(manager), "manager account not found");
  usecase_table usecasetable(get_self(), get_self().value);
  const auto& uc = usecasetable.find(usecase.value);
  if(add) {
     check(uc == usecasetable.end(), "usecase already exists");
     usecasetable.emplace(get_self(), [&]( auto& s ) {
      s.usecase = usecase;
      s.manager = manager;
    });
  } else {
    check(uc != usecasetable.end(), ("usecase '"+usecase.to_string()+"' does not exist").c_str());
    check(uc->manager == manager, ("'"+manager.to_string()+"' does not manage usecase '"+usecase.to_string()+"'").c_str());
    usecasetable.erase(uc);
    utils::delete_table<token_tables>(get_self(), usecase.value);
  }
}
  
void tokensmaster::usecasecfg(name usecase, bool unique_symbols, string allowed_chain, string required_fields)
{
  usecase_table usecasetable(get_self(), get_self().value);
  const auto& uc = usecasetable.get(usecase.value, "usecase not found");
  require_auth(uc.manager);
  check(allowed_chain.size() < 13, "chain name too long");
  int name_length = 0;
  const char* charmap = ".12345abcdefghijklmnopqrstuvwxyz";
  for (auto x : required_fields) {
    if (x == ' ') {
      name_length = 0;
    } else {
      check(strchr(charmap, x) != NULL, "invalid field name");
      check(++name_length < 13, "field name too long");
    }
  }
  usecasetable.modify (uc, uc.manager, [&]( auto& s ) {
    s.unique_symbols = unique_symbols;
    s.allowed_chain = allowed_chain;
    s.required_fields = required_fields;
  });
  
}
  
string tokensmaster::check_json_fields(std::map<string,bool>& field_list, const string& input)
{
  int fields_remain = field_list.size();
  string field;
  size_t cp, s;
  cp = input.find_first_of("{");
  if (cp==string::npos) { 
    return "no open brace";
  }
  while(fields_remain) {
    cp = input.find_first_of("\"", cp+1);
    if (cp==string::npos) { return "expected \""; }
    s = cp+1;
    cp = input.find_first_of("\"", cp+1);
    field = input.substr(s, cp-s);
    cp = input.find_first_of(":", cp+1);
    cp = input.find_first_of("{,\"", cp+1);
    s = cp+1;
    if(input[cp]=='{') {
      return "reached {";
    }
    if(input[cp]=='"') { 
      do {
        cp = input.find_first_of("\"", cp+1);
      } while (input[cp-1]=='\\');
    }
    if ( field_list.find(field) != field_list.end() ) {
      if (!field_list[field]) {
        --fields_remain;
        field_list[field] = true; }
    }
    cp = input.find_first_of(",}", cp+1);
    if(input[cp]=='}' && fields_remain) {
      string rv = "missing "+std::to_string(fields_remain)+" :";
      for (const auto& kv : field_list) {
        if(!kv.second) { 
          rv += " "+kv.first;
        }
      }
      return rv;
    }
  }
  return "";
}

