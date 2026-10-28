// Theme boundary for the imported dashboard template.
//
// The template's header toggle calls useTheme(), which throws outside a
// provider. The provider lives only in the /dashboard subtree. It does mutate
// document.documentElement (the template toggle and the cem token layer both
// read the class from there), so AdminThemeScope restores the previous html
// classes on unmount: an owner who switches to light and then returns to the
// member app does not carry the dashboard light palette into the member shell
// or the stage.
//
// defaultTheme is dark: the cem palette is a dark ramp and dark is the admin
// brand default. Light is a supported, explicit choice.
import { useLayoutEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { ThemeProvider } from '../../context/shadcntheme/ThemeContext'

function AdminThemeScope() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = {
      light: root.classList.contains('light'),
      dark: root.classList.contains('dark'),
    }

    return () => {
      root.classList.remove('light', 'dark')
      if (previous.light) root.classList.add('light')
      if (previous.dark) root.classList.add('dark')
    }
  }, [])

  return <Outlet />
}

export default function AdminThemeBoundary() {
  return (
    <ThemeProvider defaultTheme="dark">
      <AdminThemeScope />
    </ThemeProvider>
  )
}
