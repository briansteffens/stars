add_node_ppa:
  cmd.run:
    - name: curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
    - unless: test -f /etc/apt/sources.list.d/nodesource.list

install_node:
  pkg.installed:
    - pkgs:
      - nodejs

server_dependencies:
  npm.installed:
    - pkgs:
      - ws
