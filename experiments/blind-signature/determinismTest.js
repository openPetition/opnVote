const BlindSignature = require('blind-signatures');
var NodeRSA = require('node-rsa');
const fs = require('fs');
var BigInteger = require('jsbn').BigInteger;


const DEMO_TOKEN = "bcf5210deddf96b181df80ae74822c82"
const DEMO_REGISTER_PRIVKEY = 'demo_privKey.pem'

const Register = {
  key: new NodeRSA(fs.readFileSync(DEMO_REGISTER_PRIVKEY, 'utf8')),
  N: null,
  E: null
};
Register.N = Register.key.keyPair.n.toString();
Register.E = Register.key.keyPair.e.toString();


const User = {
  unblindedToken: DEMO_TOKEN,
  blindedToken: null,
  r: new BigInteger("338922692460374891126404547797748834225460220127150478321098751665786312456122334570901368631018529430015369091509876298707759325509158311610008930741474"), //private Factor
  blindedSignature: null, // Blinded Signature received from Register
  unblindedSignature: null,
};

const SVS = {
  unblindedSignature: null,
  unblindedToken: null

}


// User locally blinds his token
const {blinded} = BlindSignature.blind({
  message: User.unblindedToken,
  N: Register.N,
  E: Register.E,
  r: User.r,
});

const blindedToken = blinded;
User.blindedToken = blindedToken
// Register receives User Blinded Token
Register.blindedToken = blindedToken;

// Register signs User Blinded Token with own key
const blindedSignature = BlindSignature.sign({
  blinded: Register.blindedToken,
  key: Register.key,
});
console.log("Register: Signing ok!")
// User receives blinded Signature
User.blindedSignature = blindedSignature

//User generates unblinded Signature
const unblindedSignature = BlindSignature.unblind({
  signed: User.blindedSignature,
  N: Register.N,
  r: User.r,
});
User.unblindedSignature = unblindedSignature;

//User Verifies unblinded signature

const result = BlindSignature.verify({
  unblinded: User.unblindedSignature,
  N: Register.N,
  E: Register.E,
  message: User.unblindedToken,
});
if (result) {
  console.log('User: Verification ok!');
} else {
  console.log('User: Verification faild');
}


// User sends SVS unblinded signature and original message
SVS.unblindedSignature = User.unblindedSignature;
SVS.unblindedToken = User.unblindedToken;

// SVS verifies
const result2 = BlindSignature.verify({
  unblinded: SVS.unblindedSignature,
  key: null,
  N: Register.N,
  E: Register.E,
  message: SVS.unblindedToken,
});
if (result2) {
  console.log('SVS: Verification ok!');
} else {
  console.log('SVS: Verification faild');
}

// Print out relevant properties of Register in hex format
console.log("Register")
console.log({
  N: Register.key.keyPair.n.toString(16),
  E: Register.key.keyPair.e.toString(16),
});

// Print out relevant properties of User in hex format
console.log("User")
console.log({
  r: User.r.toString(16),
  unblindedToken: User.unblindedToken,
  blindedToken: User.blindedToken.toString(16),
  blindedSignature: User.blindedSignature.toString(16),
  unblindedSignature: User.unblindedSignature.toString(16),
});

console.log("SVS")
console.log({
  unblindedSignature: SVS.unblindedSignature.toString(16),
  unblindedToken: SVS.unblindedToken,
});





