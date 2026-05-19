<?php
use Symfony\Component\HttpFoundation\Request;
require 'bootstrap.php';

class SamplePhp {
    public function handleRequest(Request $request) {
        return "Processed";
    }
}
