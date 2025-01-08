import { RegisterKey } from '../models/RegisterKey';
import { RSAParams } from 'votingsystem';
import { validateRSAParams } from 'votingsystem';

export class RegisterKeyService {

    /**
    * @throws {Error} If the RSA parameters are invalid
    */
    static async getKeysByElectionId(electionId: number): Promise<RSAParams | null> {
        const keyPair: RegisterKey | null = await RegisterKey.findOne({ where: { electionId } });

        if (!keyPair) {
            return null;
        }

        const rsaParams = {
            e: BigInt(keyPair.E),
            N: BigInt(keyPair.N),
            D: BigInt(keyPair.D),
            NbitLength: keyPair.NbitLength
        };

        validateRSAParams(rsaParams);

        return rsaParams;
    }

    static async storeKeys(
        electionId: number,
        rsaParams: RSAParams
    ): Promise<RegisterKey> {
        validateRSAParams(rsaParams);

        if (!rsaParams.D || !rsaParams.e) {
            throw new Error('Invalid RSA parameters');
        }

        const existingKeys = await RegisterKey.findOne({ where: { electionId } });
        if (existingKeys) {
            throw new Error(`Key already exist for election ${electionId}`);
        }

        const keyPair = new RegisterKey();
        keyPair.electionId = electionId;
        keyPair.N = rsaParams.N.toString();
        keyPair.D = rsaParams.D!.toString();
        keyPair.E = rsaParams.e!.toString();
        keyPair.NbitLength = rsaParams.NbitLength;

        return await keyPair.save();
    }
}