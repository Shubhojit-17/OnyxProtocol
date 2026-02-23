import json
with open("/contracts/target/dev/onyx_darkpool_OnyxDarkPool.contract_class.json") as f:
    d = json.load(f)
with open("/contracts/abi/onyx_darkpool.json", "w") as f:
    json.dump(d["abi"], f, indent=2)
print("Done")
