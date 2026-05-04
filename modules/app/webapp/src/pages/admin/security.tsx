import AppLayout from "@/client/layout/layout";
import {
    ShieldCheckIcon,
    KeyIcon,
    EyeIcon,
    ExclamationTriangleIcon,
    LockClosedIcon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";

export default function SecurityPage() {
    return (
        <AppLayout>
            <div className="p-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground flex items-center">
                        <ShieldCheckIcon className="h-8 w-8 mr-3 text-primary" />
                        Security Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor security events, manage access controls, and
                        configure security policies
                    </p>
                </div>

                {/* Security Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <LockClosedIcon className="h-8 w-8 text-green-600 mr-3" />
                            <div>
                                <h3 className="text-lg font-medium text-green-900">
                                    Security Status
                                </h3>
                                <p className="text-green-700">
                                    All systems secure
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <UserGroupIcon className="h-8 w-8 text-blue-600 mr-3" />
                            <div>
                                <h3 className="text-lg font-medium text-blue-900">
                                    Active Sessions
                                </h3>
                                <p className="text-blue-700">12 users online</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 mr-3" />
                            <div>
                                <h3 className="text-lg font-medium text-yellow-900">
                                    Security Alerts
                                </h3>
                                <p className="text-yellow-700">
                                    2 pending reviews
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Access Control */}
                    <div className="bg-card border border-border rounded-lg">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-lg font-medium text-foreground flex items-center">
                                <KeyIcon className="h-5 w-5 mr-2 text-primary" />
                                Access Control
                            </h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex justify-between items-center py-2">
                                <span className="text-foreground">
                                    Role-based Access Control
                                </span>
                                <span className="text-green-600 text-sm font-medium">
                                    Enabled
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-foreground">
                                    Multi-factor Authentication
                                </span>
                                <span className="text-yellow-600 text-sm font-medium">
                                    Recommended
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-foreground">
                                    Session Timeout
                                </span>
                                <span className="text-muted-foreground text-sm">
                                    24 hours
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-foreground">
                                    Password Policy
                                </span>
                                <span className="text-green-600 text-sm font-medium">
                                    Strict
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Audit Log */}
                    <div className="bg-card border border-border rounded-lg">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-lg font-medium text-foreground flex items-center">
                                <EyeIcon className="h-5 w-5 mr-2 text-primary" />
                                Security Audit Log
                            </h3>
                        </div>
                        <div className="p-4">
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3 text-sm">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                                    <div className="flex-1">
                                        <p className="text-foreground">
                                            User login successful
                                        </p>
                                        <p className="text-muted-foreground">
                                            admin@iot-platform.dev - 2 minutes
                                            ago
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3 text-sm">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                    <div className="flex-1">
                                        <p className="text-foreground">
                                            Schema registered
                                        </p>
                                        <p className="text-muted-foreground">
                                            sensor-data-v2 - 15 minutes ago
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3 text-sm">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                                    <div className="flex-1">
                                        <p className="text-foreground">
                                            Failed login attempt
                                        </p>
                                        <p className="text-muted-foreground">
                                            unknown@example.com - 1 hour ago
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3 text-sm">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                                    <div className="flex-1">
                                        <p className="text-foreground">
                                            System backup completed
                                        </p>
                                        <p className="text-muted-foreground">
                                            Automated - 3 hours ago
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Policies */}
                <div className="mt-8 bg-card border border-border rounded-lg">
                    <div className="p-4 border-b border-border">
                        <h3 className="text-lg font-medium text-foreground">
                            Security Policies
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-medium text-foreground mb-3">
                                    Authentication Policies
                                </h4>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>
                                        • Minimum 8 characters password length
                                    </li>
                                    <li>
                                        • Password must contain special
                                        characters
                                    </li>
                                    <li>
                                        • Account lockout after 5 failed
                                        attempts
                                    </li>
                                    <li>
                                        • Session expires after 24 hours of
                                        inactivity
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-medium text-foreground mb-3">
                                    Data Protection
                                </h4>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>
                                        • All data encrypted in transit (TLS
                                        1.3)
                                    </li>
                                    <li>• Database encryption at rest</li>
                                    <li>• Regular automated backups</li>
                                    <li>• GDPR compliance measures</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
