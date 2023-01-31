import { Authenticator, ThemeProvider } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import useAmplifyTheme from "./hooks/useAmplifyTheme";
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Container,
  Typography,
} from "@mui/material";
import { Logout, Menu as MenuIcon } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";

const components = {
  Header() {
    return (
      <Typography textAlign={"center"} variant={"h4"} mb={2}>
        Microfrontend Version Management
      </Typography>
    );
  },
};

const MenuItemLink = styled(MenuItem)({
  color: "inherit",
  textDecoration: "none",
});

const App = ({ signOut }) => {
  const location = useLocation();
  const [anchorElNav, setAnchorElNav] = useState(null);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  return (
    <>
      <CssBaseline />
      <AppBar position={"sticky"}>
        <Container maxWidth="xl">
          <Toolbar>
            <Typography
              variant="h6"
              component="div"
              sx={{
                mr: 2,
                display: { xs: "none", md: "flex" },
                fontWeight: 700,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              Microfrontend Version Management
            </Typography>
            <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
              <IconButton
                size="large"
                aria-label="nav menu"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleOpenNavMenu}
                color="inherit"
              >
                <MenuIcon />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorElNav}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "left",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
                open={!!anchorElNav}
                onClose={handleCloseNavMenu}
                sx={{
                  display: { xs: "block", md: "none" },
                }}
              >
                <MenuItemLink as={Link} to={"/"} onClick={handleCloseNavMenu}>
                  <Typography
                    sx={{
                      fontWeight: location.pathname === "/" ? "bold" : "normal",
                    }}
                    textAlign="center"
                  >
                    Home
                  </Typography>
                </MenuItemLink>
                <MenuItemLink
                  as={Link}
                  to={"/config"}
                  onClick={handleCloseNavMenu}
                >
                  <Typography
                    sx={{
                      fontWeight:
                        location.pathname === "/config" ? "bold" : "normal",
                    }}
                    textAlign="center"
                  >
                    Config
                  </Typography>
                </MenuItemLink>
              </Menu>
            </Box>
            <Typography
              textAlign={"center"}
              variant="h6"
              component="div"
              sx={{
                mr: 2,
                display: { xs: "flex", md: "none" },
                flexGrow: 1,
                fontWeight: 700,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              Microfrontend Version Management
            </Typography>
            <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}>
              <Button
                component={Link}
                to={"/"}
                sx={{
                  color: "white",
                  fontWeight: location.pathname === "/" ? "bold" : "normal",
                }}
              >
                Home
              </Button>
              <Button
                component={Link}
                to={"/config"}
                sx={{
                  color: "white",
                  fontWeight:
                    location.pathname === "/config" ? "bold" : "normal",
                }}
              >
                Config
              </Button>
            </Box>
            <IconButton
              size="large"
              aria-label="logout"
              color="inherit"
              onClick={signOut}
            >
              <Logout />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>
      <Outlet />
    </>
  );
};

function AuthenticatedApp() {
  const theme = useAmplifyTheme();
  return (
    <ThemeProvider theme={theme}>
      <Authenticator components={components} hideSignUp={true}>
        {({ signOut, user }) => (
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary
                onReset={reset}
                fallbackRender={({ error, resetErrorBoundary }) => (
                  <Stack spacing={2} p={4} align={"center"}>
                    <Typography
                      color={"white"}
                      variant={"h5"}
                      textAlign={"center"}
                    >
                      Unexpected Error Occurred!
                    </Typography>
                    <Typography color={"error"}>{error.message}</Typography>
                    <Box>
                      <Button
                        size={"large"}
                        variant={"contained"}
                        onClick={() => resetErrorBoundary()}
                      >
                        Try again
                      </Button>
                    </Box>
                  </Stack>
                )}
              >
                <App signOut={signOut} user={user} />
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        )}
      </Authenticator>
    </ThemeProvider>
  );
}

export default AuthenticatedApp;
