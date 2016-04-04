postfix_packages:
  pkg.installed:
    - pkgs:
      - postfix

postfix_main_cf_delete:
  file.absent:
    - name: /etc/postfix/main.cf

postfix_main_cf:
  file.symlink:
    - name: /etc/postfix/main.cf
    - target: /srv/salt/files/main.cf

postfix_restart:
  service.running:
    - name: postfix
    - reload: True
    - watch:
      - file: postfix_main_cf
