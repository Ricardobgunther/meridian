<?php

it('boots app', fn () => $this->get('/')->assertStatus(200));
