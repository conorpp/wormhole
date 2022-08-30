module wormhole::MintWrapped {
    //use 0x1::string::{Self};
    use 0x1::vector::{Self};
    use 0x1::code::{Self};
    use wormhole::serialize::serialize_u64;
    use wormhole::wormhole::{wormhole_signer, WormholeCapability};
    
    public fun construct_payload():(vector<u8>, vector<u8>){
        let metadata_serialized = vector::empty();
        let code = vector::empty();
        (metadata_serialized, code)
    }

    public entry fun createWrapped(location: address, decimals: u64) acquires WormholeCapability{

        //let name = string::utf8(b"token");
        //let symbol = string::utf8(b"T");

        let bytes = vector::empty();
        vector::push_back(&mut bytes, 0x12);
        serialize_u64(&mut bytes, decimals);

        let (metadata_serialized, code) = construct_payload();

        let wormhole = wormhole_signer();
        code::publish_package_txn(&wormhole, metadata_serialized, code);
    }

    //  public entry fun upgrade(_anyone: &signer, metadata_serialized: vector<u8>, code: vector<vector<u8>>) acquires WormholeCapability {
    //     // TODO(csongor): gate this with `UpgradeCapability` above and check
    //     // that metadata_serialized's hash matches that
    //     let wormhole = wormhole_signer();
    //     code::publish_package_txn(&wormhole, metadata_serialized, code);
    // }



}