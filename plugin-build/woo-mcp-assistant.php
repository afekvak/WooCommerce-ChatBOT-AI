<?php
/**
 * Plugin Name: Woo MCP Assistant
 * Description: Injects the WooCommerce MCP AI Assistant widget into the WordPress admin area (local assets mode).
 * Version: 0.2.0
 * Author: Afek&Lior
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

const WOO_MCP_OPTION_CLIENT_KEY = 'woo_mcp_client_key';
const WOO_MCP_OPTION_ENABLED    = 'woo_mcp_enabled';

/**
 * Change this to your MCP server chat endpoint when testing locally.
 * IMPORTANT:
 * - If WP admin is loaded over HTTPS and this is HTTP, the browser may block it (mixed content).
 */
if ( ! defined( 'WOO_MCP_CHAT_SERVER' ) ) {
    define( 'WOO_MCP_CHAT_SERVER', 'https://alexa-missing-delma.ngrok-free.dev/chat' );
}

function woo_mcp_register_admin_menu() {
    add_menu_page(
        'Woo MCP Assistant',
        'Woo MCP Assistant',
        'manage_options',
        'woo-mcp-assistant',
        'woo_mcp_render_settings_page',
        'dashicons-format-chat',
        58
    );

    add_submenu_page(
        'woo-mcp-assistant',
        'Woo MCP Assistant Settings',
        'Settings',
        'manage_options',
        'woo-mcp-assistant',
        'woo_mcp_render_settings_page'
    );
}
add_action( 'admin_menu', 'woo_mcp_register_admin_menu' );

function woo_mcp_sanitize_enabled( $value ) {
    return $value === '1' ? '1' : '0';
}

function woo_mcp_register_settings() {
    register_setting(
        'woo_mcp_settings_group',
        WOO_MCP_OPTION_CLIENT_KEY,
        array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
        )
    );

    register_setting(
        'woo_mcp_settings_group',
        WOO_MCP_OPTION_ENABLED,
        array(
            'type'              => 'string',
            'sanitize_callback' => 'woo_mcp_sanitize_enabled',
            'default'           => '1',
        )
    );
}
add_action( 'admin_init', 'woo_mcp_register_settings' );

function woo_mcp_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $client_key = get_option( WOO_MCP_OPTION_CLIENT_KEY, '' );
    $enabled    = get_option( WOO_MCP_OPTION_ENABLED, '1' );
    ?>
    <div class="wrap">
        <h1>Woo MCP Assistant</h1>

        <p>
            Paste the Client Key you received from the Woo MCP dashboard.
            The assistant widget will be injected into the WordPress admin area when enabled.
        </p>

        <p>
            Current chat server:
            <code><?php echo esc_html( WOO_MCP_CHAT_SERVER ); ?></code>
        </p>

        <form method="post" action="options.php">
            <?php
            settings_fields( 'woo_mcp_settings_group' );
            do_settings_sections( 'woo_mcp_settings_group' );
            ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="woo_mcp_client_key">Client Key</label>
                    </th>
                    <td>
                        <input
                            type="text"
                            id="woo_mcp_client_key"
                            name="<?php echo esc_attr( WOO_MCP_OPTION_CLIENT_KEY ); ?>"
                            value="<?php echo esc_attr( $client_key ); ?>"
                            class="regular-text"
                        />
                        <p class="description">Example: <code>TEST123</code></p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="woo_mcp_enabled">Enable widget in admin</label>
                    </th>
                    <td>
                        <label>
                            <input
                                type="checkbox"
                                id="woo_mcp_enabled"
                                name="<?php echo esc_attr( WOO_MCP_OPTION_ENABLED ); ?>"
                                value="1"
                                <?php checked( '1', $enabled ); ?>
                            />
                            Load the assistant widget on all admin pages
                        </label>
                        <p class="description">
                            Uncheck this to stop injecting the widget without removing the Client Key.
                        </p>
                    </td>
                </tr>
            </table>

            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

/**
 * Inject widget.js from plugin assets into WP admin
 */
function woo_mcp_admin_footer_inject_widget() {
    $client_key = get_option( WOO_MCP_OPTION_CLIENT_KEY, '' );
    $enabled    = get_option( WOO_MCP_OPTION_ENABLED, '1' );

    if ( empty( $client_key ) || '1' !== $enabled ) {
        return;
    }

    // Prevent duplicate injection
    static $already_injected = false;
    if ( $already_injected ) {
        return;
    }
    $already_injected = true;

    // IMPORTANT: widget.js will load widget.css + widget.runtime.js from the same folder path.
    $widget_src = plugins_url( 'assets/widget.js', __FILE__ ) . '?v=' . time();
    $chat_server = WOO_MCP_CHAT_SERVER;

    ?>
    <script
        src="<?php echo esc_url( $widget_src ); ?>"
        data-server="<?php echo esc_attr( $chat_server ); ?>"
        data-client-key="<?php echo esc_attr( $client_key ); ?>"
        data-title="Shop Assistant"
        defer
    ></script>
    <?php
}
add_action( 'admin_footer', 'woo_mcp_admin_footer_inject_widget' );
