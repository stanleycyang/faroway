/**
 * Compatibility endpoint for clients that still call /api/user/account.
 * Account deletion is implemented once in /api/user/profile.
 */

export { DELETE } from "@/app/api/user/profile/route";
