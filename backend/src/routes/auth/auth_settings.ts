import { AppSettingsRepository } from "../../DB/repositories/AppSettingsRepository";
import { getLogger } from '../../observability/requestContext';

const AUTH_SETTINGS_KEY = 'auth';

export interface AuthSettings {
    allowEmailRegistration: boolean;
    allowPhoneRegistration: boolean;
}

const DEFAULT_SETTINGS: AuthSettings = {
    allowEmailRegistration: true,
    allowPhoneRegistration: true,
};

export async function getAuthSettings(): Promise<AuthSettings> {
    const repo = new AppSettingsRepository();
    const doc = await repo.getByKey(AUTH_SETTINGS_KEY);

    if (!doc) {
        getLogger().debug('No auth settings document found, using defaults');
        return DEFAULT_SETTINGS;
    }

    return {
        allowEmailRegistration: doc.allowEmailRegistration ?? DEFAULT_SETTINGS.allowEmailRegistration,
        allowPhoneRegistration: doc.allowPhoneRegistration ?? DEFAULT_SETTINGS.allowPhoneRegistration,
    };
}

export async function updateAuthSettings(patch: Partial<AuthSettings>): Promise<AuthSettings> {
    const repo = new AppSettingsRepository();
    const current = await getAuthSettings();
    const merged = { ...current, ...patch };

    await repo.upsertByKey(AUTH_SETTINGS_KEY, merged);
    getLogger().debug({ patch, merged }, 'Persisted auth settings');

    return merged;
}
