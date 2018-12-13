const express = require('express')
const debug = require('debug')('express-mustache-jwt-signin')
const setupMustache = require('express-mustache-overlays')
const path = require('path')
const { setupLogin } = require('../lib')
const { createCredentialsFromWatchedUsersYaml } = require('../lib/loadUsers')

const scriptName = process.env.SCRIPT_NAME || '/'
const port = process.env.PORT || 9005
let httpsOnly = (process.env.HTTPS_ONLY || 'true').toLowerCase()
if (httpsOnly === 'false') {
  httpsOnly = false
} else {
  httpsOnly = true
  debug('Only setting cookies for HTTPS access. If you can\'t log in, make sure you are accessing the server over HTTPS.')
}
const secret = process.env.SECRET
if (!secret || secret.length < 8) {
  throw new Error('No SECRET environment variable set, or the SECRET is too short. Need 8 characters')
}
const mustacheDirs = path.join(__dirname, '..', 'views')

// const credentials = {
//   'hello': { password: 'world', claims: {'admin': true} }
// }
//
// or
//
// async function credentials (username, password) {
//   if (username === 'hello' && password === 'world') {
//     return { 'admin': true }
//   }
//   throw new Error('Invalid credentials')
// }
//
// or
//
// Use the createCredentialsFromWatchedUsersYaml to specify users in a yaml file as we do here.

const main = async () => {
  const userData = await createCredentialsFromWatchedUsersYaml(path.join(__dirname, '..', 'yaml', 'users.yml'))

  const app = express()
  const { withUser, signedIn, hasClaims } = setupLogin(app, secret, userData.credentials, { httpsOnly })

  const adminURL = '/user/admin'

  const templateDefaults = { title: 'Title', scriptName, adminURL, signOutURL: '/user/signout', signInURL: '/user/signin' }
  await setupMustache(app, templateDefaults, mustacheDirs)

  // Make req.user available to everything
  app.use(withUser)

  app.get('/', (req, res) => {
    res.redirect('/user/')
  })

  app.get('/user/', (req, res) => {
    res.render('main', { user: req.user, title: 'Home', content: '<h1>Home</h1><p>Hello!</p>' })
  })

  app.get('/user/dashboard', signedIn, (req, res) => {
    res.render('main', { title: 'Dashboard', user: req.user, content: '<h1>Dashboard</h1><p>Not much to see here.</p>' })
  })

  app.get('/user/admin', hasClaims(claims => claims.admin), (req, res) => {
    res.render('main', { title: 'Admin', user: req.user, content: '<h1>Admin</h1><p>Only those with the <tt>admin</tt> claim set to <tt>true</tt> can see this.</p>' })
  })

  app.use(express.static(path.join(__dirname, '..', 'public')))

  // Must be after other routes - Handle 404
  app.get('*', (req, res) => {
    res.status(404)
    res.render('404', { user: req.user })
  })

  // Error handler has to be last
  app.use(function (err, req, res, next) {
    debug('Error:', err)
    res.status(500).send('Something broke!')
  })

  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()

// Better handling of SIGNIN for docker
process.on('SIGINT', function () {
  console.log('Exiting ...')
  process.exit()
})
