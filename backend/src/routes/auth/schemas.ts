import { object, string, boolean, mixed } from 'yup';
import { ClientType } from './session_management';

export const clientSchema = mixed<ClientType>().oneOf(['web', 'mobile', 'desktop']).required();

export const otpRequestSchema = object({
    phoneNumber: string().matches(/^09[0-9]{9}$/).required(),
    locale: string().oneOf(['en', 'fa']).optional().default('en'),
});

export const otpVerifySchema = object({
    client: clientSchema,
    phoneNumber: string().matches(/^09[0-9]{9}$/).required(),
    code: string().length(6).required(),
});

export const registerSchema = object({
    client: clientSchema,
    email: string().email().required(),
    password: string().min(8).required(),
});

export const loginSchema = object({
    client: clientSchema,
    email: string().email().required(),
    password: string().required(),
});

export const refreshSchema = object({
    client: clientSchema.default('web'),
    refreshToken: string().optional(), // mobile/desktop send this; web relies on the cookie
});

export const adminSettingsSchema = object({
    allowEmailRegistration: boolean().optional(),
    allowOtp: boolean().optional(),
});