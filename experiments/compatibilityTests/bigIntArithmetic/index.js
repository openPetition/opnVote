import * as bigintModArith from 'https://cdn.jsdelivr.net/npm/bigint-mod-arith@3.0.0/dist/esm/index.browser.js';

document.addEventListener('DOMContentLoaded', () => {
    const unblindedTokenBigInput = document.getElementById('unblindedTokenBig');
    const rBigInput = document.getElementById('rBig');
    const eInput = document.getElementById('e');
    const NInput = document.getElementById('N');
    const output = document.getElementById('output');
    
    document.getElementById('withLib').addEventListener('click', () => {
        const unblindedTokenBig = BigInt(unblindedTokenBigInput.value);
        const rBig = BigInt(rBigInput.value);
        const e = BigInt(eInput.value);
        const N = BigInt(NInput.value);
        
        try {
            const blindedHexBig = (unblindedTokenBig * bigintModArith.modPow(rBig, e, N)) % N;
            output.innerText = `Calc with lib result: ${blindedHexBig.toString(16)}`;
        } catch (error) {
            console.error('Error on lib calc:', error);
            output.innerText = 'Error on calc with lib. Check console for details.';
        }
    });
    
    document.getElementById('withoutLib').addEventListener('click', () => {
        const unblindedTokenBig = BigInt(unblindedTokenBigInput.value);
        const rBig = BigInt(rBigInput.value);
        const e = BigInt(eInput.value);
        const N = BigInt(NInput.value);
        
        try {
            const blindedHexBig = (unblindedTokenBig * (rBig ** e)) % N;
            output.innerText = `Calc witout lib result: ${blindedHexBig.toString(16)}`;
        } catch (error) {
            console.error('Error native calc:', error);
            output.innerText = 'Error on native calc. Check console for details.';
        }
    });
});
