#include <eosio/eosio.hpp>

using eosio::name;
using std::string;

namespace tables {
  TABLE user_table {
    name account;
    name status;
    name type;
    string nickname;
    string image;
    string story;
    string roles;
    string skills;
    string interests;
    uint64_t reputation;
    uint64_t timestamp;

    uint64_t primary_key()const { return account.value; }
    uint64_t by_reputation()const { return reputation; }
  };
}