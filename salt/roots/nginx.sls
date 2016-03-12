nginx_install:
  pkg.installed:
    - pkgs:
      - nginx

nginx_delete_default_conf:
  file.absent:
    - name: /etc/nginx/sites-enabled/default

nginx_conf:
  file.symlink:
    - name: /etc/nginx/sites-enabled/stars
    - target: /srv/salt/files/nginx.conf

nginx_service_restart:
  service.running:
    - name: nginx
    - reload: True
    - watch:
      - file: nginx_conf
