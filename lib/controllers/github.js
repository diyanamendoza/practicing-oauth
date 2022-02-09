const { Router } = require('express');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/authenticate');
const GithubUser = require('../models/GithubUser');
const fetch = require('cross-fetch');
const { exchangeCodeForToken, getGithubProfile } = require('../utils/github');

module.exports = Router()
  .get('/login', async (req, res) => {
    res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URI}&scope=user`
    );
  })

  .get('/login/callback', async (req, res) => {
    //  * get code
    const { code } = req.query;
    //  * exchange code for token
    const tokenRequest = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code, // <-- the code
        }),
      }
    );
    // convert to json
    const { access_token } = await tokenRequest.json();
    //  * get info from github about user with token
    const profileRequest = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/json',
        Authorization: `token ${access_token}`,
      },
    });

    // in profile res, username = login, avatar = avatar_url, email = email
    // const { login, avatar_url, email } = await profileRequest.json();
    const profile = await profileRequest.json();
    console.log(profile);
    //  * get existing user if there is one
    let user = await GithubUser.findByUsername(login);
    //  * if not, create one
    if (!user) {
      user = await GithubUser.insert({
        username: login,
        avatar: avatar_url,
        email: email,
      });
    }
    //  * create jwt
    const userJwt = await jwt.sign({ ...user }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    //  * set cookie and redirect
    res
      .cookie('session', userJwt, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
      })
      .redirect('/dashboard');
  })

  .get('/dashboard', authenticate, async (req, res) => {
    // require req.user
    // get data about user and send it as json
    res.json(req.user);
  })
  .delete('/sessions', (req, res) => {
    res
      .clearCookie(process.env.COOKIE_NAME)
      .json({ success: true, message: 'Signed out successfully!' });
  });
