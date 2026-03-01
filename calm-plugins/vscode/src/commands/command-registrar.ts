import type { ApplicationStoreApi } from '../application-store'
import type { NavigationService } from '../core/services/navigation-service'
import type { Config } from '../core/ports/config'
import type { Logger } from '../core/ports/logger'
import { createOpenPreviewCommand } from './open-preview-command'
import { createSearchTreeViewCommand } from './search-tree-view-command'
import { createClearTreeViewSearchCommand } from './clear-tree-view-search-command'
import { createCreateWebsiteCommand } from './create-website/create-website-command'
import { createNavigateToArchitectureCommand } from './navigate-to-architecture-command'
import { authLoginCommand, authLogoutCommand, authStatusCommand, authRefreshCommand } from './auth-commands'
import * as vscode from 'vscode'

export class CommandRegistrar {
    constructor(
        private context: vscode.ExtensionContext,
        private store: ApplicationStoreApi,
        private navigation: NavigationService,
        private config: Config,
        private logger: Logger
    ) { }

    registerAll() {
        const commands = [
            createOpenPreviewCommand(this.store),
            createSearchTreeViewCommand(this.store),
            createClearTreeViewSearchCommand(this.store),
            createCreateWebsiteCommand(this.context),
            createNavigateToArchitectureCommand(this.navigation)
        ]

        commands.forEach(disposable => {
            this.context.subscriptions.push(disposable)
        })

        // Register authentication commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('calm.auth.login', () => authLoginCommand(this.config, this.logger))
        )
        this.context.subscriptions.push(
            vscode.commands.registerCommand('calm.auth.logout', () => authLogoutCommand(this.config, this.logger))
        )
        this.context.subscriptions.push(
            vscode.commands.registerCommand('calm.auth.status', () => authStatusCommand(this.config, this.logger))
        )
        this.context.subscriptions.push(
            vscode.commands.registerCommand('calm.auth.refresh', () => authRefreshCommand(this.config, this.logger))
        )
    }
}
