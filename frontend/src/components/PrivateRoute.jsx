import React, { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { isAuthenticated } from '../auth'

function PrivateRoute() {
  const [authChecked, setAuthChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const auth = await isAuthenticated()
      setAuthenticated(auth)
      setAuthChecked(true)
    }
    checkAuth()
  }, [])

  if (!authChecked) {
    return <p></p>
  }

  return authenticated ? <Outlet /> : <Navigate to="/login" />
}

export default PrivateRoute
