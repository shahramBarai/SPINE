import { BrowserRouter, Route, Routes } from "react-router-dom";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import AppLayout from "./layout/layout";
import { ThemeProvider } from "hooks/useTheme";
import { AuthProvider } from "./hooks/useAuth";
import { DashboardPage } from "pages/dashboard";
import { NotFound } from "pages/404";

import { ApiProvider } from "utils/trpc";
import { AuthPage } from "pages/auth";
import { DigitalTwin } from "pages/projects/digitalTwin";
import { ProjectsPage } from "pages/projects";

import { ToastContainer } from "react-toastify";

createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
        <ApiProvider>
            <BrowserRouter>
                <AuthProvider>
                    <Routes>
                        <Route
                            path="/"
                            element={<AppLayout>Root Page</AppLayout>}
                        />
                        <Route
                            path="/auth"
                            element={<AuthPage isDevelopment={true} />}
                        />
                        <Route
                            path="/dashboard"
                            element={
                                <AppLayout>
                                    <DashboardPage />
                                </AppLayout>
                            }
                        />
                        <Route
                            path="/projects"
                            element={
                                <AppLayout>
                                    <ProjectsPage />
                                </AppLayout>
                            }
                        />
                        <Route path="/digital-twin" element={<DigitalTwin />} />
                        <Route
                            path="/digital-twin/:projectId"
                            element={<DigitalTwin />}
                        />
                        {/* 404 Route */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
            <ToastContainer />
        </ApiProvider>
    </ThemeProvider>
);
