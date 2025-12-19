// // src/middleware/jwtAuth.ts

// import type { Request, Response, NextFunction } from "express";
// import jwt from "jsonwebtoken";
// import { findUserById } from "../services/userService";

// declare module "express-serve-static-core" {
//   interface Request {
//     currentUser?: any;
//   }
// }

// export async function jwtAuth(
//   req: Request,
//   _res: Response,
//   next: NextFunction
// ) {
//   try {
//     const auth = req.headers.authorization;

//     if (!auth || !auth.startsWith("Bearer ")) {
//       req.currentUser = null;
//       return next();
//     }

//     const token = auth.slice("Bearer ".length).trim();
//     if (!token) {
//       req.currentUser = null;
//       return next();
//     }

//     const secret = process.env.JWT_SECRET;
//     if (!secret) {
//       console.error("[jwtAuth] Missing JWT_SECRET env var");
//       req.currentUser = null;
//       return next();
//     }

//     const payload = jwt.verify(token, secret) as any;

//     // adjust field name to your real payload (userId, sub, etc.)
//     const userId = payload.userId || payload.sub;
//     if (!userId) {
//       req.currentUser = null;
//       return next();
//     }

//     const user = await findUserById(Number(userId));
//     if (!user) {
//       req.currentUser = null;
//       return next();
//     }

//     req.currentUser = user;
//     return next();
//   } catch (err) {
//     console.error("[jwtAuth] error verifying token:", err);
//     req.currentUser = null;
//     return next();
//   }
// }
