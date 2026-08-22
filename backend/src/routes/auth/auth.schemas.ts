import { object, string, boolean, mixed } from 'yup';
import { ClientType } from './session_management';

export const otpRequestSchema = object({
    phoneNumber: string().matches(/^09[0-9]{9}$/).required(),
    purpose: mixed<'register' | 'login'>().oneOf(['register', 'login']).required(),
    locale: string().oneOf(['en', 'fa']).optional().default('en')
});

export const clientSchema = mixed<ClientType>().oneOf(['web', 'mobile', 'desktop']).required();

export const registerSchema = object({
    client: clientSchema,
    username: string().required(),
    method: mixed<'email' | 'phone'>().oneOf(['email', 'phone']).required(),
    email: string().email().when('method', { is: 'email', then: (s) => s.required() }),
    password: string().min(8).when('method', { is: 'email', then: (s) => s.required() }),
    phoneNumber: string().matches(/^09[0-9]{9}$/).when('method', { is: 'phone', then: (s) => s.required() }),
    code: string().length(6).when('method', { is: 'phone', then: (s) => s.required() }),
});

export const loginSchema = object({
    client: clientSchema,
    method: mixed<'email' | 'phone'>().oneOf(['email', 'phone']).required(),
    email: string().email().when('method', { is: 'email', then: (s) => s.required() }),
    password: string().when('method', { is: 'email', then: (s) => s.required() }),
    phoneNumber: string().matches(/^09[0-9]{9}$/).when('method', { is: 'phone', then: (s) => s.required() }),
    code: string().length(6).when('method', { is: 'phone', then: (s) => s.required() }),
});

export const refreshSchema = object({
    client: clientSchema.default('web'),
    refreshToken: string().optional(), // mobile/desktop send this; web relies on the cookie
});

export const adminSettingsSchema = object({
    allowEmailRegistration: boolean().optional(),
    allowPhoneRegistration: boolean().optional(),
});