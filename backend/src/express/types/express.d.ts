import { JwtPayload } from "jsonwebtoken";
import { Privileges } from "../../DB/models/Plan";
import { Usage, UsageField } from "../../DB/models/Usage";
import { User } from "../../DB/models/User";

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string
                userData: User
                privileges?: Privileges
                usages?: Usage
                jwtPayload?: JwtPayload
            }
            quotaReservations?: {
                userId: string
                usages: Map<UsageField, number>
            }[]
        }
    }
}

// ensures this file is treated as a module
export { }; 