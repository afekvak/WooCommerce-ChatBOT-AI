<?php
/**
 * Plugin Name: Woo MCP Assistant
 * Description: Injects the WooCommerce MCP AI Assistant widget into the WordPress admin area.
 * Version: 0.1.0
 * Author: Afek&Lior
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// option name in wp options table
const WOO_MCP_OPTION_CLIENT_KEY = 'woo_mcp_client_key';

// base url of the MCP server
// for local development keep localhost
// later in production change this to your EC2 url
if ( ! defined( 'WOO_MCP_SERVER_BASE' ) ) {
    define( 'WOO_MCP_SERVER_BASE', 'http://localhost:3000' );
}

/**
 * Register top level admin menu for Woo MCP Assistant
 */
function woo_mcp_register_admin_menu() {
    add_menu_page(
        'Woo MCP Assistant',            // page title
        'Woo MCP Assistant',            // menu title
        'manage_options',               // capability
        'woo-mcp-assistant',            // slug
        'woo_mcp_render_settings_page', // callback
        'dashicons-robot',              // icon
        58                              // position
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

/**
 * Register setting for client key
 */
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
}
add_action( 'admin_init', 'woo_mcp_register_settings' );

/**
 * Render the settings page
 */
function woo_mcp_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $client_key = get_option( WOO_MCP_OPTION_CLIENT_KEY, '' );
    ?>
    <div class="wrap">
        <h1>Woo MCP Assistant</h1>

        <p>
            Paste the Client Key you received from the Woo MCP dashboard.
            The assistant widget will be injected into the WordPress admin area
            for your browser.
        </p>

        <p>
            Current MCP server base:
            <code><?php echo esc_html( WOO_MCP_SERVER_BASE ); ?></code>
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
                        <p class="description">
                            Example: <code>TEST123</code>
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
 * Inject widget.js into wp admin footer on all admin pages
 */
function woo_mcp_admin_footer_inject_widget() {
    $client_key = get_option( WOO_MCP_OPTION_CLIENT_KEY, '' );

    if ( empty( $client_key ) ) {
        return;
    }

    // dev version bump so changes to widget.js show immediately
    $version    = time(); // for development only
    $mcp_base   = rtrim( WOO_MCP_SERVER_BASE, '/' );
    $widget_src = $mcp_base . '/widget.js?v=' . $version;
    $chat_server = $mcp_base . '/chat';

    ?>
    <script
        src="<?php echo esc_url( $widget_src ); ?>"
        data-server="<?php echo esc_attr( $chat_server ); ?>"
        data-client-key="<?php echo esc_attr( $client_key ); ?>"
        data-title="Shop Assistant"
        data-theme="dark"
        defer
    ></script>
    <?php
}
add_action( 'admin_footer', 'woo_mcp_admin_footer_inject_widget' );
