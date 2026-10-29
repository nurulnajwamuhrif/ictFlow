const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

// 1. USER REGISTRATION
router.post('/register', async (req, res) => {
  const { password, namaPengguna, role, email, noTel } = req.body;

  try {
    // Check if user already exists in public.users
    const userCheck = await pool.query(
      'SELECT * FROM public.users WHERE lower(email) = lower($1)',
      [email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Hash the password for security
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into public.users table
    const newUser = await pool.query(
      `INSERT INTO public.users (name, email, password, role, phone_number) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, role`,
      [namaPengguna, email, hashedPassword, role || 'user', noTel]
    );

    res.status(201).json({
      message: 'User registered successfully!',
      user: newUser.rows[0]
    });
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ message: 'Server Error during registration' });
  }
});

// 2. USER LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email from public.users
    const userResult = await pool.query(
      'SELECT * FROM public.users WHERE lower(email) = lower($1)',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid Email or Password' });
    }

    const user = userResult.rows[0];

    // Verify hashed password
    const isMatch = await bcrypt.compare(password, user.password || user.Password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Email or Password' });
    }

    // Generate JWT Token
    const jwtSecret = process.env.JWT_SECRET || 'ictflow_fallback_jwt_secret_key';
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      jwtSecret,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        namaPengguna: user.name || user.nama_pengguna,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).json({ message: 'Server Error during login' });
  }
});

module.exports = router;