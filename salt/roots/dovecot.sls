dovecot_packages:
  pkg.installed:
    - pkgs:
      - dovecot-imapd

dovecot_restart:
  service.running:
    - name: dovecot
    - reload: True
    - watch:
      - pkg: dovecot_packages
