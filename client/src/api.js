import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: 12000,
});

export function apiError(error) {
  return error.response?.data?.error?.message
    ?? error.response?.data?.error
    ?? error.response?.data?.message
    ?? error.message
    ?? "We couldn't complete that request. Please try again.";
}

export async function fetchProducts(params = {}, signal) {
  const { data } = await api.get("/products", { params, signal });
  return data.data;
}

export function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}
