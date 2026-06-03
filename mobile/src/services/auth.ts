import axios from "axios";
import { useAccessToken } from "../stores/accessToken";
import { getRefreshToken, saveRefreshToken } from "../stores/refreshToken";
import { string } from "yup";

const api = axios.create({ baseURL: "https://memoize.hirbod-codes.ir/api" });
const apiAuth = axios.create({ baseURL: "https://memoize.hirbod-codes.ir/api" });

// Add access token
apiAuth.interceptors.request.use((config) => {
    const token = useAccessToken.getState().accessToken;

    if (token)
        config.headers.Authorization = `Bearer ${token}`;

    return config;
});

// Refresh access token if necessary
apiAuth.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            // Because the request object is about to be discarded, we don't set to false later.
            originalRequest._retry = true;

            const token = await refreshAccessToken();

            originalRequest.headers.Authorization = `Bearer ${token}`;

            return apiAuth(originalRequest);
        }

        return Promise.reject(error);
    }
);

export async function refreshAccessToken() {
    const refreshToken = await getRefreshToken();

    if (!refreshToken)
        throw new Error("No refresh token");

    const response = await api.post("/auth/refresh", { refreshToken, noCookies: 'true' });

    const { accessToken } = response.data;
    console.log('refreshAccessToken', response.data);

    const validatedAccessToken = string().required().strict().validateSync(accessToken)

    useAccessToken
        .getState()
        .setAccessToken(validatedAccessToken);

    return validatedAccessToken;
}

export async function register(password: string, username?: string, email?: string, phoneNumber?: string) {
    const data = { noCookies: 'true' } as any

    if (!username && !email && !phoneNumber)
        throw new Error('invalid input')

    if (username)
        data.username = username
    else if (email)
        data.email = email
    else
        data.phoneNumber = phoneNumber

    data.password = password

    const response = await api.post("/auth/register", data);

    const { accessToken, refreshToken, } = response.data;
    console.log('register', response.data);

    useAccessToken
        .getState()
        .setAccessToken(accessToken);

    await saveRefreshToken(refreshToken);
}

export async function login(identifier: string, password: string) {
    const response = await api.post("/auth/login", { identifier, password, noCookies: 'true' });

    const { accessToken, refreshToken, } = response.data;
    console.log('login', response.data);

    useAccessToken
        .getState()
        .setAccessToken(accessToken);

    await saveRefreshToken(refreshToken);
}

export async function logout(refreshToken: string, accessToken?: string | null | undefined) {
    await api.post("/auth/logout", { refreshToken, accessToken });
}

export { apiAuth }