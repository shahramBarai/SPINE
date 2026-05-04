import AppLayout from "@/client/layout/layout";
import { Button } from "@/client/components/basics/Button";
import { UsersIcon, PlusIcon } from "@heroicons/react/24/outline";

export default function UserManagementPage() {
    return (
        <AppLayout>
            <div className="p-6">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center">
                            <UsersIcon className="h-8 w-8 mr-3 text-primary" />
                            User Management
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage platform users, roles, and permissions
                        </p>
                    </div>
                    <Button className="flex items-center">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Add User
                    </Button>
                </div>

                {/* Admin Feature Notice */}
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                        Administrator Features
                    </h2>
                    <p className="text-muted-foreground">
                        This page is only accessible to users with administrator
                        privileges. Here you can manage user accounts, assign
                        roles, and configure access permissions.
                    </p>
                </div>

                {/* Users Table Placeholder */}
                <div className="bg-card border border-border rounded-lg">
                    <div className="p-4 border-b border-border">
                        <h3 className="text-lg font-medium text-foreground">
                            Platform Users
                        </h3>
                    </div>
                    <div className="p-6 text-center text-muted-foreground">
                        <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>User management interface coming soon...</p>
                        <p className="text-sm mt-2">
                            This will include user listing, role assignment, and
                            permission management.
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
