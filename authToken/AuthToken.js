import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    console.log("No token found in cookie");
    return res.status(401).json({ authenticated: false, message: "No token" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("Invalid token:", err.message);
      return res.status(403).json({ authenticated: false, message: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
}
