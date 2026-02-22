import { useEffect, useState } from 'react';
import { loginUser, logoutUser } from '../services/api';

export function useAuth() {
	const readUser = () => {
		try {
			const stored = localStorage.getItem('auth_user') || localStorage.getItem('current_user');
			return stored ? JSON.parse(stored) : null;
		} catch {
			return null;
		}
	};

	const [user, setUser] = useState<any>(() => readUser());

	useEffect(() => {
		const handler = () => setUser(readUser());
		window.addEventListener('auth_user_updated', handler as EventListener);
		window.addEventListener('storage', handler as EventListener);
		return () => {
			window.removeEventListener('auth_user_updated', handler as EventListener);
			window.removeEventListener('storage', handler as EventListener);
		};
	}, []);

	const isAuthenticated = Boolean(user);

	async function login(emailOrUsername: string, password: string, opts?: any) {
		const payload = { emailOrUsername, password };
		const res = await loginUser(payload);
		if (res?.token) {
			localStorage.setItem('auth_token', res.token);
		}
		if (res?.user) {
			localStorage.setItem('auth_user', JSON.stringify(res.user));
			window.dispatchEvent(new Event('auth_user_updated'));
			setUser(res.user);
		}
		return res;
	}

	async function logout(opts?: any) {
		try {
			await logoutUser();
		} catch {
			// ignore
		}
		localStorage.removeItem('auth_token');
		localStorage.removeItem('auth_user');
		window.dispatchEvent(new Event('auth_user_updated'));
		setUser(null);
	}

	return { user, isAuthenticated, login, logout };
}
